import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ConnexionPage from './pages/auth/ConnexionPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ClassesPage from './pages/classes/ClassesPage';
import FicheClassePage from './pages/classes/FicheClassePage';
import PageElectifsClasse from './pages/classes/PageElectifsClasse';
import PageLotsFlexibles from './pages/lots/PageLotsFlexibles';
import PageEtudiantsParCours from './pages/lots/PageEtudiantsParCours';
import EtudiantsPage from './pages/etudiants/EtudiantsPage';
import FicheEtudiantPage from './pages/etudiants/FicheEtudiantPage';
import PageDispenses from './pages/etudiants/PageDispenses';
import NotesPage from './pages/notes/NotesPage';
import AbsencesPage from './pages/absences/AbsencesPage';
import HistoriqueAbsencesPage from './pages/absences/HistoriqueAbsencesPage';
import BulletinPage from './pages/bulletins/BulletinPage';
import RattrapagePage from './pages/rattrapage/RattrapagePage';
import RoutePrivee from './components/RoutePrivee';

/**
 * Le fournisseur d'année (via RoutePrivee) n'enveloppe QUE les routes
 * authentifiées ci-dessous — jamais /connexion, qui reste volontairement
 * en dehors de tout ça. Voir RoutePrivee.tsx pour l'explication complète.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<ConnexionPage />} />
        <Route
          path="/"
          element={
            <RoutePrivee>
              <DashboardPage />
            </RoutePrivee>
          }
        />
        <Route
          path="/classes"
          element={
            <RoutePrivee>
              <ClassesPage />
            </RoutePrivee>
          }
        />
        <Route
          path="/classes/:id"
          element={
            <RoutePrivee>
              <FicheClassePage />
            </RoutePrivee>
          }
        />
        <Route
          path="/classes/:id/electifs"
          element={
            <RoutePrivee>
              <PageElectifsClasse />
            </RoutePrivee>
          }
        />
        <Route
          path="/classes/:id/lots"
          element={
            <RoutePrivee>
              <PageLotsFlexibles />
            </RoutePrivee>
          }
        />
        <Route
          path="/classes/:id/etudiants-par-cours"
          element={
            <RoutePrivee>
              <PageEtudiantsParCours />
            </RoutePrivee>
          }
        />
        <Route
          path="/etudiants"
          element={
            <RoutePrivee>
              <EtudiantsPage />
            </RoutePrivee>
          }
        />
        <Route
          path="/etudiants/:id"
          element={
            <RoutePrivee>
              <FicheEtudiantPage />
            </RoutePrivee>
          }
        />
        <Route
          path="/dispenses/:inscriptionId"
          element={
            <RoutePrivee>
              <PageDispenses />
            </RoutePrivee>
          }
        />
        <Route
          path="/notes"
          element={
            <RoutePrivee>
              <NotesPage />
            </RoutePrivee>
          }
        />
        <Route
          path="/absences"
          element={
            <RoutePrivee>
              <AbsencesPage />
            </RoutePrivee>
          }
        />
        <Route
          path="/absences/historique"
          element={
            <RoutePrivee>
              <HistoriqueAbsencesPage />
            </RoutePrivee>
          }
        />
        <Route
          path="/bulletins"
          element={
            <RoutePrivee>
              <BulletinPage />
            </RoutePrivee>
          }
        />
        <Route
          path="/rattrapage"
          element={
            <RoutePrivee>
              <RattrapagePage />
            </RoutePrivee>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
