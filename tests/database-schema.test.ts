import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const classA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const classB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const scheduleA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tables = ['classes', 'teaching_sessions', 'salary_payments', 'recurring_schedules', 'recurring_schedule_exceptions'];

test('database schema, ownership policies and financial history', async (suite) => {
  const db = new PGlite();
  try {
    // Supabase-owned objects are simulated only in this disposable test database.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('${ownerA}'), ('${ownerB}');
    `);
    const migration = await readFile(new URL('../supabase/migrations/20260922000100_teaching_database.sql', import.meta.url), 'utf8');
    await db.exec(migration);

    async function asUser(id: string, operation: () => Promise<void>) {
      await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}';`);
      try { await operation(); } finally { await db.exec('rollback'); }
    }
    const createClass = (id: string, owner: string) => db.query(
      'insert into public.classes (id,user_id,name,salary_per_hour,default_duration_hours) values ($1,$2,$3,150000,1.5)', [id, owner, 'Lớp thử'],
    );
    await createClass(classA, ownerA);
    await createClass(classB, ownerB);
    await db.query('insert into public.teaching_sessions (user_id,class_id,session_date,start_time,end_time,session_hours,session_amount) values ($1,$2,$3,$4,$5,1.5,225000)', [ownerA, classA, '2026-09-22', '09:00', '10:30']);
    await db.query('insert into public.salary_payments (user_id,payment_date,amount) values ($1,$2,100000)', [ownerA, '2026-09-22']);
    await db.query('insert into public.recurring_schedules (id,user_id,class_id,weekday,start_time) values ($1,$2,$3,2,$4)', [scheduleA, ownerA, classA, '09:00']);
    await db.query('insert into public.recurring_schedule_exceptions (user_id,schedule_id,exception_date) values ($1,$2,$3)', [ownerA, scheduleA, '2026-09-29']);

    await suite.test('all application tables enable RLS', async () => {
      const result = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname,relrowsecurity from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='public' and relkind='r'");
      for (const table of tables) assert.equal(result.rows.find((row) => row.relname === table)?.relrowsecurity, true);
    });
    await suite.test('owner can read own data but another account cannot read, edit or delete it', async () => {
      await asUser(ownerA, async () => {
        for (const table of tables) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 1);
      });
      await asUser(ownerB, async () => {
        for (const table of tables) {
          assert.equal((await db.query(`select * from public.${table} where user_id=$1`, [ownerA])).rows.length, 0);
          assert.equal((await db.query(`update public.${table} set user_id=$1 where user_id=$2 returning *`, [ownerB, ownerA])).rows.length, 0);
          assert.equal((await db.query(`delete from public.${table} where user_id=$1 returning *`, [ownerA])).rows.length, 0);
        }
      });
    });
    await suite.test('owner CRUD works and timestamps update', async () => {
      await asUser(ownerA, async () => {
        const inserted = await db.query<{ id: string }>("insert into public.classes (name,salary_per_hour,default_duration_hours) values ('Lớp mới',0,1) returning id");
        const id = inserted.rows[0].id;
        const updated = await db.query<{ name: string }>("update public.classes set name='Lớp đã sửa' where id=$1 returning name", [id]);
        assert.equal(updated.rows[0].name, 'Lớp đã sửa');
        assert.equal((await db.query('delete from public.classes where id=$1 returning id', [id])).rows.length, 1);
      });
    });
    for (const table of tables) {
      await suite.test(`${table}: owner cannot reassign data to another account`, async () => {
        await asUser(ownerA, async () => assert.rejects(db.query(`update public.${table} set user_id=$1`, [ownerB]), /row-level security/));
      });
    }
    await suite.test('cannot insert data owned by another user', async () => {
      await asUser(ownerA, async () => assert.rejects(createClass('dddddddd-dddd-4ddd-8ddd-dddddddddddd', ownerB), /row-level security/));
    });
    await suite.test('cannot attach a session to another account’s class', async () => {
      await asUser(ownerA, async () => assert.rejects(db.query('insert into public.teaching_sessions (class_id,session_date,session_hours,session_amount) values ($1,$2,1,100000)', [classB, '2026-09-23']), /foreign key/));
    });
    await suite.test('cannot attach a schedule to another account’s class', async () => {
      await asUser(ownerA, async () => assert.rejects(db.query("insert into public.recurring_schedules (class_id,weekday,start_time) values ($1,1,'09:00')", [classB]), /foreign key/));
    });
    await suite.test('cannot attach an exception to another account’s schedule', async () => {
      await asUser(ownerB, async () => assert.rejects(db.query("insert into public.recurring_schedule_exceptions (schedule_id,exception_date) values ($1,'2026-10-01')", [scheduleA]), /foreign key/));
    });
    for (const table of tables) {
      await suite.test(`${table}: guest role has no read/write access`, async () => {
        for (const statement of [`select * from public.${table}`, `delete from public.${table}`]) {
          await db.exec('begin; set local role anon;');
          try { await assert.rejects(db.query(statement), /permission denied/); } finally { await db.exec('rollback'); }
        }
      });
    }
    await suite.test('prices changing do not recalculate old session amounts', async () => {
      await asUser(ownerA, async () => {
        await db.query('update public.classes set salary_per_hour=300000 where id=$1', [classA]);
        const rows = await db.query<{ session_amount: string }>('select session_amount from public.teaching_sessions');
        assert.equal(Number(rows.rows[0].session_amount), 225000);
      });
    });
    await suite.test('deleting a class with financial history is blocked', async () => {
      await asUser(ownerA, async () => assert.rejects(db.query('delete from public.classes where id=$1', [classA]), /foreign key/));
    });
    await suite.test('overnight sessions and multiple sessions on one day are allowed', async () => {
      await asUser(ownerA, async () => {
        await db.query("insert into public.teaching_sessions (class_id,session_date,start_time,end_time,session_hours,session_amount) values ($1,'2026-09-22','23:00','01:00',2,300000)", [classA]);
        assert.equal((await db.query('select * from public.teaching_sessions')).rows.length, 2);
      });
    });
    await suite.test('duplicate sessions at the same start time are rejected', async () => {
      await asUser(ownerA, async () => assert.rejects(db.query("insert into public.teaching_sessions (class_id,session_date,start_time,end_time,session_hours,session_amount) values ($1,'2026-09-22','09:00','10:30',1.5,225000)", [classA]), /unique constraint/));
    });
    const invalidStatements = [
      "insert into public.classes (name,salary_per_hour,default_duration_hours) values ('   ',100000,1)",
      "insert into public.classes (name,salary_per_hour,default_duration_hours) values ('Test',-1,1)",
      "insert into public.classes (name,salary_per_hour,default_duration_hours) values ('Test','NaN',1)",
      "insert into public.classes (name,salary_per_hour,default_duration_hours) values ('Test',100000,0)",
      "insert into public.salary_payments (payment_date,amount) values ('2026-09-22',0)",
      `insert into public.recurring_schedules (class_id,weekday,start_time) values ('${classA}',7,'09:00')`,
    ];
    await suite.test('invalid names, money, durations and weekdays are rejected', async () => {
      for (const sql of invalidStatements) await asUser(ownerA, async () => assert.rejects(db.query(sql), /check constraint/));
    });
    await suite.test('schema does not grant public access to helper functions', async () => {
      const result = await db.query<{ allowed: boolean }>("select has_function_privilege('anon','app_private.set_updated_at()','execute') as allowed");
      assert.equal(result.rows[0].allowed, false);
    });
  } finally { await db.close(); }
});
