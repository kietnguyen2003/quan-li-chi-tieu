import { Header } from './components/Header'

function App() {

  return (
    <div className="min-h-screen bg-natural-bg text-natural-text font-sans selection:bg-natural-accent/20 pb-20">
      <Header currentDate={new Date()} onPrevMonth={() => {}} onNextMonth={() => {}}>

      </Header>
   
    </div>
  )
}

export default App
