import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { obtenirUtilisateurConnecte, deconnecter } from '../services/auth.service';
import { supprimerAnneeUniversitaire, definirAnneeActive } from '../services/referentiel.service';
import { useAnneeUniversitaire } from '../contexts/AnneeUniversitaireContext';
import SelecteurAnneeGlobal from './SelecteurAnneeGlobal';
import PanneauCreationAnnee from './PanneauCreationAnnee';
import PanneauChangementMotDePasse from './PanneauChangementMotDePasse';
import './EnTete.css';

/**
 * En-tête partagé par tous les écrans authentifiés.
 */
export default function EnTete() {
  const navigate = useNavigate();
  const utilisateur = obtenirUtilisateurConnecte();
  const { annees, anneeSelectionneeId, rafraichirAnnees, setAnneeSelectionneeId } = useAnneeUniversitaire();
  const [panneauAnneeOuvert, setPanneauAnneeOuvert] = useState(false);
  const [panneauMotDePasseOuvert, setPanneauMotDePasseOuvert] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [enCoursSuppression, setEnCoursSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [enCoursActivation, setEnCoursActivation] = useState(false);

  function gererDeconnexion() {
    deconnecter();
    navigate('/connexion');
  }

  async function gererAnneeCreee(annee: { id: string }) {
    await rafraichirAnnees();
    setAnneeSelectionneeId(annee.id); // bascule directement sur l'année qu'on vient de créer
    setPanneauAnneeOuvert(false);
    navigate('/');
  }

  async function gererSuppressionAnnee() {
    if (!anneeSelectionneeId) return;

    if (!confirmationSuppression) {
      setConfirmationSuppression(true);
      return;
    }

    setEnCoursSuppression(true);
    setErreurSuppression(null);
    try {
      await supprimerAnneeUniversitaire(anneeSelectionneeId);
      await rafraichirAnnees();
      setConfirmationSuppression(false);
    } catch (erreur: unknown) {
      const message =
        (erreur as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de supprimer cette année.';
      setErreurSuppression(message);
      setConfirmationSuppression(false);
    } finally {
      setEnCoursSuppression(false);
    }
  }

  async function gererActivationAnnee() {
    if (!anneeSelectionneeId) return;
    setEnCoursActivation(true);
    try {
      await definirAnneeActive(anneeSelectionneeId);
      await rafraichirAnnees();
    } catch {
      // Silencieux ici — un échec d'activation n'empêche pas de
      // continuer à travailler sur l'année déjà sélectionnée.
    } finally {
      setEnCoursActivation(false);
    }
  }

  const anneeSelectionnee = annees.find((a) => a.id === anneeSelectionneeId);

  return (
    <header className="en-tete">
      <div className="en-tete-ligne-haute">
        <div className="en-tete-identite">
          <div className="en-tete-logo">
            <img src="/logo.png" alt="ISB International School of Business" />
          </div>
          <span className="en-tete-nom">ISB International School of Business</span>
        </div>

        <div className="en-tete-groupe-annee">
          <SelecteurAnneeGlobal />
          {anneeSelectionnee && !anneeSelectionnee.estActive && (
            <button
              className="en-tete-bouton-nouvelle-annee"
              onClick={gererActivationAnnee}
              disabled={enCoursActivation}
              title={`Marquer ${anneeSelectionnee.libelle} comme année active`}
            >
              {enCoursActivation ? 'Activation...' : 'Activer cette année'}
            </button>
          )}
          <button
            className="en-tete-bouton-nouvelle-annee"
            onClick={() => setPanneauAnneeOuvert(true)}
            title="Créer une nouvelle année universitaire"
          >
            + Nouvelle année
          </button>
          {anneeSelectionnee && (
            <button
              className="en-tete-bouton-nouvelle-annee en-tete-bouton-danger"
              onClick={gererSuppressionAnnee}
              disabled={enCoursSuppression}
              title={`Supprimer ${anneeSelectionnee.libelle}`}
            >
              {enCoursSuppression
                ? 'Suppression...'
                : confirmationSuppression
                ? 'Confirmer ?'
                : `Supprimer ${anneeSelectionnee.libelle}`}
            </button>
          )}
          {erreurSuppression && (
            <div className="en-tete-bulle-erreur" role="alert">
              {erreurSuppression}
            </div>
          )}
        </div>

        <div className="en-tete-utilisateur">
          <span>{utilisateur?.nom}</span>
          <button className="en-tete-bouton-deconnexion" onClick={() => setPanneauMotDePasseOuvert(true)}>
            Changer le mot de passe
          </button>
          <button className="en-tete-bouton-deconnexion" onClick={gererDeconnexion}>
            Se déconnecter
          </button>
        </div>
      </div>

      <nav className="en-tete-navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'lien-actif' : '')}>
          Tableau de bord
        </NavLink>
        <NavLink to="/classes" className={({ isActive }) => (isActive ? 'lien-actif' : '')}>
          Classes
        </NavLink>
        <NavLink to="/etudiants" className={({ isActive }) => (isActive ? 'lien-actif' : '')}>
          Étudiants
        </NavLink>
        <NavLink to="/notes" className={({ isActive }) => (isActive ? 'lien-actif' : '')}>
          Notes
        </NavLink>
        <NavLink to="/absences" className={({ isActive }) => (isActive ? 'lien-actif' : '')}>
          Absences
        </NavLink>
        <NavLink to="/bulletins" className={({ isActive }) => (isActive ? 'lien-actif' : '')}>
          Bulletins
        </NavLink>
        <NavLink to="/rattrapage" className={({ isActive }) => (isActive ? 'lien-actif' : '')}>
          Rattrapage
        </NavLink>
      </nav>

      {panneauAnneeOuvert && (
        <PanneauCreationAnnee onAnneeCreee={gererAnneeCreee} onAnnuler={() => setPanneauAnneeOuvert(false)} />
      )}

      {panneauMotDePasseOuvert && (
        <PanneauChangementMotDePasse onFerme={() => setPanneauMotDePasseOuvert(false)} />
      )}
    </header>
  );
}
