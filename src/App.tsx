import { useGameStore } from './store/gameStore';
import Home from './pages/Home';
import Prepare from './pages/Prepare';
import Game from './pages/Game';
import GameOver from './pages/GameOver';
import Upgrade from './pages/Upgrade';

export default function App() {
  const { screen } = useGameStore();

  switch (screen) {
    case 'title':
      return <Home />;
    case 'prepare':
      return <Prepare />;
    case 'game':
      return <Game />;
    case 'gameover':
      return <GameOver />;
    case 'upgrade':
      return <Upgrade />;
    default:
      return <Home />;
  }
}
