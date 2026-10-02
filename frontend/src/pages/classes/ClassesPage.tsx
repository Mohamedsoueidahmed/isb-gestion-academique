import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import PanneauCreationClasse from './PanneauCreationClasse';
import { listerClasses } from '../../services/classes.service';
import { useAnneeUniversitaire } from '../../contexts/AnneeUniversitaireContext';
import type { Classe } from '../../types/classes.types';
import '../../styles/listes.css';

export default function ClassesPage() {
  const navigate = useNavigate();
  const { anneeSelectionneeId } = useAnneeUniversitaire();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [enChargement, setEnChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  useEffect(() => {
    chargerClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneeSelectionneeId]);

  function chargerClasses() {
    if (!anneeSelectionneeId) return;
    setEnChargement(true);
    listerClasses({ anneeUniversitaireId: anneeSelectionneeId })
      .then(setClasses)
      .catch(() => setErreur('Impossible de charger les classes.'))
      .finally(() => setEnChargement(false));
  }

  function gererClasseCreee() {
    setPanneauOuvert(false);
    chargerClasses(); // on recharge depuis le serveur plutôt que d'insérer localement, pour rester source-de-vérité unique
  }

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <div className="entete-page">
          <h1>Classes</h1>
          <button className="bouton-principal" onClick={() => setPanneauOuvert(true)}>
            Créer une classe
          </button>
        </div>

        {enChargement && <p className="ligne-vide">Chargement...</p>}
        {erreur && <p className="ligne-vide" style={{ color: 'var(--couleur-erreur)' }}>{erreur}</p>}

        {!enChargement && !erreur && (
          <table className="tableau-liste">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Parcours</th>
                <th>Niveau</th>
                <th>Semestre bulletin</th>
                <th>Année universitaire</th>
                <th>Effectif</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ligne-vide">Aucune classe créée pour le moment.</td>
                </tr>
              ) : (
                classes.map((classe) => (
                  <tr
                    className="ligne-cliquable"
                    key={classe.id}
                    onClick={() => navigate(`/classes/${classe.id}`)}
                  >
                    <td>{classe.nom}</td>
                    <td>{classe.parcours.nom}</td>
                    <td>{classe.niveau.libelle}</td>
                    <td>{classe.semestreActif.libelle}</td>
                    <td>{classe.anneeUniversitaire.libelle}</td>
                    <td>
                      <span className="badge">
                        {classe._count?.inscriptions ?? 0} étudiant(s)
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {panneauOuvert && (
        <PanneauCreationClasse
          onClasseCreee={gererClasseCreee}
          onAnnuler={() => setPanneauOuvert(false)}
        />
      )}
    </div>
  );
}
