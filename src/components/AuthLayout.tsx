import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth';
import './auth.css';

export function AuthLayout({ children }: { children: ReactNode }) {
  const { isPasswordRecovery } = useAuth();
  return (
    <main className="auth-page">
      <aside className="auth-story" aria-label="Training Camp">
        <Link className="auth-brand" to={isPasswordRecovery ? '/reset-password' : '/'} aria-label={isPasswordRecovery ? 'Training Camp' : 'Training Camp — về lịch dạy'}>
          <img src="/image.png" alt="" width="44" height="44" />
          <span>Training Camp<small>KHÔNG GIAN CỦA NGƯỜI DẠY</small></span>
        </Link>
        <div className="auth-story-content">
          <p className="auth-eyebrow">GỌN LỊCH DẠY. NHẸ TÂM TRÍ.</p>
          <h2>Mỗi buổi dạy,<br />đều được<br /><em>ghi nhớ.</em></h2>
          <p className="auth-story-description">Một nơi để sắp xếp lịch lớp, ghi nhận giờ dạy<br className="hidden xl:block" /> và theo dõi thành quả của bạn.</p>
          <div className="auth-notebook" aria-hidden="true">
            <div className="auth-notebook-heading"><span>Một ngày dạy học</span><ArrowUpRight size={18} /></div>
            <div className="auth-notebook-row"><span>09:00</span><div><strong>Lớp học buổi sáng</strong><small>Sẵn sàng cho một khởi đầu tốt</small></div><Check size={17} /></div>
            <div className="auth-notebook-row"><span>14:30</span><div><strong>Thêm một giờ truyền cảm hứng</strong><small>Từng buổi dạy đều có ý nghĩa</small></div><span className="auth-schedule-dot" /></div>
            <div className="auth-notebook-footer">Lịch minh họa<span>Học · Dạy · Trưởng thành</span></div>
          </div>
        </div>
        <p className="auth-story-footer">Ít việc quản lý hơn. Nhiều thời gian giảng dạy hơn.</p>
      </aside>
      <section className="auth-main">
        {!isPasswordRecovery && <Link to="/" className="auth-back"><ArrowLeft size={16} /> Về lịch dạy</Link>}
        <div className="auth-form-wrap">{children}</div>
        <p className="auth-local-note">Đăng nhập để lưu và truy cập lịch dạy trên các thiết bị.<br />Dữ liệu không đăng nhập chỉ được lưu trên trình duyệt này.</p>
      </section>
    </main>
  );
}
