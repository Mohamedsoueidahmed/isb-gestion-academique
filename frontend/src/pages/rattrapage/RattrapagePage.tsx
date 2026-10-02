import { useEffect, useState } from 'react';
import EnTete from '../../components/EnTete';
import { obtenirEtudiantsRattrapage, telechargerExportRattrapagePdf } from '../../services/rattrapage.service';
import { useAnneeUniversitaire } from '../../contexts/AnneeUniversitaireContext';
import type { EtudiantRattrapage } from '../../types/rattrapage.types';
import '../../styles/listes.css';
import './RattrapagePage.css';

interface GroupeCours {
  coursCode: string;
  coursTitre: string;
  etudiants: EtudiantRattrapage[];
}

interface GroupeClasse {
  classe: string;
  cours: GroupeCours[];
}

interface GroupeNiveau {
  niveau: string;
  classes: GroupeClasse[];
}

interface GroupeParcours {
  parcours: string;
  niveaux: GroupeNiveau[];
}

/**
 * Regroupe la liste plate en quatre niveaux : parcours, puis niveau, puis
 * classe, puis cours — chaque cours ne montrant que les étudiants qui ont
 * réellement besoin d'y faire leur session 2. Le backend renvoie déjà les
 * résultats triés par parcours puis niveau, ce qui place naturellement les
 * classes d'un même niveau à la suite les unes des autres — on ne re-trie
 * donc pas ici, l'ordre d'insertion suffit.
 */
function grouperParParcoursNiveauClasseEtCours(liste: EtudiantRattrapage[]): GroupeParcours[] {
  const parParcours = new Map<string, Map<string, Map<string, Map<string, EtudiantRattrapage[]>>>>();

  for (const item of liste) {
    if (!parParcours.has(item.parcours)) {
      parParcours.set(item.parcours, new Map());
    }
    const parNiveau = parParcours.get(item.parcours)!;

    if (!parNiveau.has(item.niveau)) {
      parNiveau.set(item.niveau, new Map());
    }
    const parClasse = parNiveau.get(item.niveau)!;

    if (!parClasse.has(item.classe)) {
      parClasse.set(item.classe, new Map());
    }
    const parCours = parClasse.get(item.classe)!;

    const cleCours = `${item.coursCode}-${item.coursTitre}`;
    if (!parCours.has(cleCours)) {
      parCours.set(cleCours, []);
    }
    parCours.get(cleCours)!.push(item);
  }

  return Array.from(parParcours.entries()).map(([parcours, niveauxMap]) => ({
    parcours,
    niveaux: Array.from(niveauxMap.entries()).map(([niveau, classesMap]) => ({
      niveau,
      classes: Array.from(classesMap.entries()).map(([classe, coursMap]) => ({
        classe,
        cours: Array.from(coursMap.values()).map((etudiants) => ({
          coursCode: etudiants[0].coursCode,
          coursTitre: etudiants[0].coursTitre,
          etudiants,
        })),
      })),
    })),
  }));
}

export default function RattrapagePage() {
  const { anneeSelectionneeId } = useAnneeUniversitaire();
  const [liste, setListe] = useState<EtudiantRattrapage[]>([]);
  const [enChargement, setEnChargement] = useState(true);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!anneeSelectionneeId) return;
    setEnChargement(true);
    obtenirEtudiantsRattrapage(anneeSelectionneeId)
      .then(setListe)
      .catch(() => setErreur('Impossible de charger la liste de rattrapage.'))
      .finally(() => setEnChargement(false));
  }, [anneeSelectionneeId]);

  const groupes = grouperParParcoursNiveauClasseEtCours(liste);

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <h1>Rattrapage (Session 2)</h1>
        <p style={{ color: 'var(--couleur-gris-texte)', fontSize: 13, marginBottom: 24 }}>
          Matières où la session 1 est en dessous du seuil de validation et où la session 2 n'a pas encore été saisie.
        </p>

        {!enChargement && !erreur && liste.length > 0 && (
          <button
            className="bouton-secondaire"
            style={{ marginBottom: 16 }}
            disabled={telechargementEnCours}
            onClick={async () => {
              setTelechargementEnCours(true);
              try {
                await telechargerExportRattrapagePdf(anneeSelectionneeId ?? undefined);
              } catch {
                setErreur('Impossible de télécharger le PDF de rattrapage.');
              } finally {
                setTelechargementEnCours(false);
              }
            }}
          >
            {telechargementEnCours ? 'Téléchargement...' : 'Télécharger la liste (PDF)'}
          </button>
        )}

        {enChargement && <p className="ligne-vide">Chargement...</p>}
        {erreur && <p className="ligne-vide" style={{ color: 'var(--couleur-erreur)' }}>{erreur}</p>}

        {!enChargement && !erreur && liste.length === 0 && (
          <p className="ligne-vide">Aucun étudiant en attente de session 2 pour le moment.</p>
        )}

        {!enChargement && !erreur && groupes.map((groupeParcours) => (
          <div className="groupe-parcours" key={groupeParcours.parcours}>
            <h2>{groupeParcours.parcours}</h2>

            {groupeParcours.niveaux.map((groupeNiveau) => (
              <div className="groupe-niveau" key={groupeNiveau.niveau}>
                <h3>{groupeNiveau.niveau}</h3>

                {groupeNiveau.classes.map((groupeClasse) => (
                  <div className="groupe-classe" key={groupeClasse.classe}>
                    <h4>{groupeClasse.classe}</h4>

                    {groupeClasse.cours.map((groupeCours) => (
                      <div className="groupe-cours" key={`${groupeCours.coursCode}-${groupeCours.coursTitre}`}>
                        <p className="groupe-cours-titre">
                          {groupeCours.coursTitre} ({groupeCours.coursCode}), {groupeCours.etudiants.length} étudiant
                          {groupeCours.etudiants.length !== 1 ? 's' : ''}
                        </p>

                        <table className="tableau-liste">
                          <thead>
                            <tr>
                              <th>Matricule</th>
                              <th>Étudiant</th>
                              <th>Moyenne (session 1)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupeCours.etudiants.map((etu) => (
                              <tr key={`${etu.inscriptionId}-${etu.coursId}`}>
                                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--couleur-gris-texte)' }}>
                                  {etu.etudiant.matricule}
                                </td>
                                <td>{etu.etudiant.nom}</td>
                                <td className="moyenne-proche">{etu.moyenneSession1 ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
