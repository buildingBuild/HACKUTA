// Optional isolated development entry; the integrated application uses /coaching.
import { createRoot } from 'react-dom/client';
import { AppNav } from '../../components/AppNav';
import { GridBackground } from '../../components/GridBackground';
import { useSessionUser } from '../../components/session';
import '../../components/theme.css';
import { MentorshipPage } from './MentorshipPage';
function Preview(){const {user,loading}=useSessionUser();return <GridBackground><AppNav user={user} path="/coaching"/>{!loading&&<MentorshipPage user={user}/>}</GridBackground>;}
createRoot(document.getElementById('root')!).render(<Preview/>);
