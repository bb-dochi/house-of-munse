import { usePath } from './router';
import { Home } from './pages/Home';
import { Collection } from './pages/Collection';
import { Reviews } from './pages/Reviews';
import { Wishlist } from './pages/Wishlist';
import { Mysteries } from './pages/Mysteries';
import { Admin } from './pages/Admin';
import { Ask } from './pages/Ask';
import { BgmButton } from './components/BgmButton';

export function App() {
  return (
    <>
      <Page />
      <BgmButton />
    </>
  );
}

function Page() {
  const path = usePath().replace(/\/+$/, '') || '/';
  if (path === '/collection') return <Collection />;
  if (path === '/reviews') return <Reviews />;
  if (path === '/wishlist') return <Wishlist />;
  if (path === '/mysteries') return <Mysteries />;
  if (path === '/admin') return <Admin />;
  if (path === '/ask') return <Ask />;
  return <Home />;
}
