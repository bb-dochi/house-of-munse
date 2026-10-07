import { usePath } from './router';
import { Home } from './pages/Home';
import { Collection } from './pages/Collection';
import { Reviews } from './pages/Reviews';
import { Wishlist } from './pages/Wishlist';
import { Admin } from './pages/Admin';

export function App() {
  const path = usePath().replace(/\/+$/, '') || '/';
  if (path === '/collection') return <Collection />;
  if (path === '/reviews') return <Reviews />;
  if (path === '/wishlist') return <Wishlist />;
  if (path === '/admin') return <Admin />;
  return <Home />;
}
