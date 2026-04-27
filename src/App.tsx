import { Navigate, Route, Routes } from 'react-router'
import Login from './pages/Login'
import MoneyManage from './pages/MoneyManage'
import {PrivateRoute} from './routes/PrivateRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />

      <Route path="/login" element={<Login />} />

      <Route
        path="/app"
        element={
          <PrivateRoute>
            <MoneyManage />
          </PrivateRoute>
        }
      />

      <Route path="*" element={<h1>404 - Page Not Found</h1>} />
    </Routes>
  )
}

export default App