import { useEffect, useState } from 'react';
import EnTete from '../../components/EnTete';
import { useAnneeUniversitaire } from '../../contexts/AnneeUniversitaireContext';
import {
  obtenirStatistiquesGlobales,
  obtenirEtudiantsParNiveau,
  obtenirEtudiantsParParcours,
  obtenirEtatSaisieClasses,
} from '../../services/dashboard.service';
import type {
  StatistiquesGlobales,
  EtudiantsParNiveau,
  EtudiantsParParcours,
  EtatSaisieClasse,
} from '../../types/dashboard.types';
import './DashboardPage.css';

export default function DashboardPage() {
  const { anneeSelectionneeId } = useAnneeUniversitaire();
  const [statistiques, setStatistiques] = useState<StatistiquesGlobales | null>(null);
  const [parNiveau, setParNiveau] = useState<EtudiantsParNiveau[]>([]);
  const [parParcours, setParParcours] = useState<EtudiantsParParcours[]>([]);
  const [etatSaisie, setEtatSaisie] = useState<EtatSaisieClasse[]>([]);
  const [enChargement, setEnChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!anneeSelectionneeId) return;

    async function chargerDonnees() {
      // Promise.allSettled plutôt que Promise.all : si une seule route échoue,
      // les autres sections du tableau de bord restent quand même utilisables
      // plutôt que de faire disparaître tout l'écran pour un seul souci.
      const resultats = await Promise.allSettled([
        obtenirStatistiquesGlobales(anneeSelectionneeId ?? undefined),
        obtenirEtudiantsParNiveau(anneeSelectionneeId ?? undefined),
        obtenirEtudiantsParParcours(anneeSelectionneeId ?? undefined),
        obtenirEtatSaisieClasses(anneeSelectionneeId ?? undefined),
      ]);

      if (resultats[0].status === 'fulfilled') setStatistiques(resultats[0].value);
      if (resultats[1].status === 'fulfilled') setParNiveau(resultats[1].value);
      if (resultats[2].status === 'fulfilled') setParParcours(resultats[2].value);
      if (resultats[3].status === 'fulfilled') setEtatSaisie(resultats[3].value);

      const echecs = resultats.filter((r) => r.status === 'rejected');
      if (echecs.length === resultats.length) {
        setErreur('Impossible de charger le tableau de bord. Vérifiez votre connexion.');
      }

      setEnChargement(false);
    }

    chargerDonnees();
  }, [anneeSelectionneeId]);

  if (enChargement) {
    return (
      <div>
        <EnTete />
        <div className="etat-chargement">Chargement du tableau de bord...</div>
      </div>
    );
  }

  if (erreur) {
    return (
      <div>
        <EnTete />
        <div className="etat-erreur">{erreur}</div>
      </div>
    );
  }

  return (
    <div>
      <EnTete />
      <div className="page-dashboard-contenu">
        <h1>Tableau de bord</h1>

        {statistiques && (
          <div className="bande-chiffres">
            <div className="chiffre-bloc">
              <div className="chiffre-valeur">{statistiques.nombreEtudiants}</div>
              <div className="chiffre-label">Étudiants actifs</div>
            </div>
            <div className="chiffre-bloc">
              <div className="chiffre-valeur">{statistiques.nombreFormations}</div>
              <div className="chiffre-label">Formations</div>
            </div>
            <div className="chiffre-bloc">
              <div className="chiffre-valeur">{statistiques.nombreParcours}</div>
              <div className="chiffre-label">Parcours</div>
            </div>
            <div className="chiffre-bloc">
              <div className="chiffre-valeur">{statistiques.nombreClasses}</div>
              <div className="chiffre-label">Classes</div>
            </div>
          </div>
        )}

        <div className="section-dashboard">
          <h2>État de saisie par classe</h2>
          <p className="section-sous-titre">
            Notes et absences saisies pour l'année universitaire en cours
          </p>
          <table className="tableau-saisie">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Parcours</th>
                <th>Niveau</th>
                <th>Semestre actif</th>
                <th>Effectif</th>
                <th>Notes saisies</th>
                <th>Absences saisies</th>
              </tr>
            </thead>
            <tbody>
              {etatSaisie.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--couleur-gris-texte)' }}>
                    Aucune classe créée pour le moment.
                  </td>
                </tr>
              ) : (
                etatSaisie.map((classe) => (
                  <tr key={classe.classeId}>
                    <td>{classe.nom}</td>
                    <td>{classe.parcours}</td>
                    <td>{classe.niveau}</td>
                    <td>{classe.semestreActif}</td>
                    <td>{classe.totalInscriptions}</td>
                    <td className={classe.pourcentageSaisieNotes === 100 ? 'statut-complet' : 'statut-incomplet'}>
                      {classe.pourcentageSaisieNotes}%
                    </td>
                    <td className={classe.pourcentageSaisieAbsences === 100 ? 'statut-complet' : 'statut-incomplet'}>
                      {classe.pourcentageSaisieAbsences}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="deux-colonnes">
          <div className="section-dashboard">
            <h2>Étudiants par niveau</h2>
            <div className="liste-repartition">
              {parNiveau.length === 0 ? (
                <div className="repartition-ligne">Aucune donnée.</div>
              ) : (
                parNiveau.map((ligne) => (
                  <div className="repartition-ligne" key={ligne.niveau?.libelle}>
                    <span>{ligne.niveau?.libelle}</span>
                    <span className="repartition-valeur">{ligne.nombreEtudiants} étudiant(s)</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="section-dashboard">
            <h2>Étudiants par parcours</h2>
            <div className="liste-repartition">
              {parParcours.length === 0 ? (
                <div className="repartition-ligne">Aucune donnée.</div>
              ) : (
                parParcours.map((ligne) => (
                  <div className="repartition-ligne" key={ligne.parcours?.id}>
                    <span>{ligne.parcours?.nom}</span>
                    <span className="repartition-valeur">{ligne.nombreEtudiants} étudiant(s)</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
