import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EnTete from '../../components/EnTete';
import { listerClasses } from '../../services/classes.service';
import { listerCoursAffectesParTerme } from '../../services/lots.service';
import { obtenirFeuilleSeance, saisirAbsences, telechargerExportAbsencesPdf } from '../../services/absences.service';
import { useAnneeUniversitaire } from '../../contexts/AnneeUniversitaireContext';
import type { Classe } from '../../types/classes.types';
import type { GroupeCoursTerme } from '../../types/lots.types';
import type { LignePresence } from '../../types/absences.types';
import './AbsencesPage.css';

const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

/**
 * Date du jour au format AAAA-MM-JJ, en heure locale — pas d'utiliser
 * toISOString() seul, qui convertit en UTC et peut décaler le jour selon
 * le fuseau horaire de l'utilisateur.
 */
function dateAujourdhui(): string {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const jour = String(maintenant.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

export default function AbsencesPage() {
  const { anneeSelectionneeId } = useAnneeUniversitaire();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [groupesTerme, setGroupesTerme] = useState<GroupeCoursTerme[]>([]);
  const [termeActif, setTermeActif] = useState<string | null>(null);
  const [lignes, setLignes] = useState<LignePresence[]>([]);
  const [absencesLocales, setAbsencesLocales] = useState<Record<string, boolean>>({});

  const [classeId, setClasseId] = useState('');
  const [coursId, setCoursId] = useState('');
  const [dateSeance, setDateSeance] = useState(dateAujourdhui());

  const [chargementCours, setChargementCours] = useState(false);
  const [chargementLignes, setChargementLignes] = useState(false);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [enCoursEnregistrement, setEnCoursEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  useEffect(() => {
    setClasseId('');
    if (!anneeSelectionneeId) return;
    listerClasses({ anneeUniversitaireId: anneeSelectionneeId }).then(setClasses);
  }, [anneeSelectionneeId]);

  useEffect(() => {
    setCoursId('');
    setTermeActif(null);
    setLignes([]);

    if (!classeId) {
      setGroupesTerme([]);
      return;
    }

    setChargementCours(true);
    listerCoursAffectesParTerme(classeId)
      .then((groupes) => {
        setGroupesTerme(groupes);
        setTermeActif(groupes[0]?.terme ?? null);
      })
      .finally(() => setChargementCours(false));
  }, [classeId]);

  function gererChangementTerme(terme: string | null) {
    setTermeActif(terme);
    setCoursId('');
    setLignes([]);
  }

  async function gererTelechargement() {
    if (!classeId) return;
    setTelechargementEnCours(true);
    setErreur(null);
    try {
      await telechargerExportAbsencesPdf(classeId, termeActif);
    } catch {
      setErreur('Impossible de télécharger le PDF de ce Terme.');
    } finally {
      setTelechargementEnCours(false);
    }
  }

  // Classe, cours ou date : les trois ensemble déterminent une séance
  // précise. Tout changement recharge la feuille depuis le serveur et
  // abandonne les cases non encore enregistrées, pour ne jamais mélanger
  // des modifications locales avec une séance différente.
  useEffect(() => {
    setConfirmationVisible(false);
    setErreur(null);

    if (!classeId || !coursId || !dateSeance) {
      setLignes([]);
      setAbsencesLocales({});
      return;
    }

    setChargementLignes(true);
    obtenirFeuilleSeance(classeId, coursId, dateSeance)
      .then((donnees) => {
        setLignes(donnees);
        const initial: Record<string, boolean> = {};
        donnees.forEach((ligne) => {
          initial[ligne.inscriptionId] = !ligne.present;
        });
        setAbsencesLocales(initial);
      })
      .catch(() => setErreur('Impossible de charger la feuille de présence.'))
      .finally(() => setChargementLignes(false));
  }, [classeId, coursId, dateSeance]);

  function basculerAbsence(inscriptionId: string) {
    setAbsencesLocales((precedent) => ({ ...precedent, [inscriptionId]: !precedent[inscriptionId] }));
    setConfirmationVisible(false);
  }

  async function gererEnregistrement() {
    setErreur(null);
    setEnCoursEnregistrement(true);

    const inscriptionsAbsentes = Object.entries(absencesLocales)
      .filter(([, estAbsent]) => estAbsent)
      .map(([inscriptionId]) => inscriptionId);

    try {
      await saisirAbsences({ classeId, coursId, dateSeance, inscriptionsAbsentes });
      setConfirmationVisible(true);
    } catch {
      setErreur("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setEnCoursEnregistrement(false);
    }
  }

  const nombreAbsents = Object.values(absencesLocales).filter(Boolean).length;

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <div className="entete-page">
          <h1>Saisie des absences</h1>
          <Link to="/absences/historique" className="bouton-secondaire">Consulter l'historique</Link>
        </div>

        <div className="selecteurs-absences">
          <div className="champ-selecteur">
            <label htmlFor="classe">Classe</label>
            <select id="classe" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">Sélectionner une classe...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {classeId && !chargementCours && groupesTerme.length === 0 && (
          <p className="ligne-vide">Aucun cours réellement affecté dans cette classe pour l'instant.</p>
        )}

        {groupesTerme.length > 0 && (
          <div className="onglets-terme">
            {groupesTerme.map((groupe) => (
              <button
                key={groupe.terme ?? 'sans-terme'}
                className={`onglet-terme ${termeActif === groupe.terme ? 'onglet-terme-actif' : ''}`}
                onClick={() => gererChangementTerme(groupe.terme)}
              >
                {LIBELLE_TERME[groupe.terme ?? ''] ?? 'Sans terme'}
              </button>
            ))}
            <button
              className="bouton-secondaire bouton-telechargement-terme"
              onClick={gererTelechargement}
              disabled={telechargementEnCours}
            >
              {telechargementEnCours ? 'Téléchargement...' : 'Télécharger ce Terme (PDF)'}
            </button>
          </div>
        )}

        {groupesTerme.length > 0 && (
          <div className="selecteurs-absences">
            <div className="champ-selecteur">
              <label htmlFor="cours">Cours</label>
              <select
                id="cours"
                value={coursId}
                onChange={(e) => setCoursId(e.target.value)}
                disabled={chargementCours}
              >
                <option value="">{chargementCours ? 'Chargement...' : 'Sélectionner un cours...'}</option>
                {(groupesTerme.find((g) => g.terme === termeActif)?.cours ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.titre} ({c.code})</option>
                ))}
              </select>
            </div>

            <div className="champ-selecteur">
              <label htmlFor="date">Date de séance</label>
              <input
                id="date"
                type="date"
                value={dateSeance}
                onChange={(e) => setDateSeance(e.target.value)}
              />
            </div>
          </div>
        )}

        {chargementLignes && <p className="ligne-vide">Chargement...</p>}

        {!chargementLignes && classeId && coursId && dateSeance && (
          <>
            <div className="bandeau-progression">
              <span>{lignes.length} étudiant{lignes.length !== 1 ? 's' : ''}</span>
              {nombreAbsents > 0 ? (
                <span className="compteur-absents">{nombreAbsents} absent{nombreAbsents !== 1 ? 's' : ''}</span>
              ) : (
                <span className="compteur-tous-presents">Tout le monde est présent</span>
              )}
            </div>

            <table className="tableau-presence">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Étudiant</th>
                  <th>Présence</th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="ligne-vide">Aucun étudiant inscrit dans cette classe.</td>
                  </tr>
                ) : (
                  lignes.map((ligne) => (
                    <tr key={ligne.inscriptionId}>
                      <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--couleur-gris-texte)' }}>
                        {ligne.etudiant.matricule}
                      </td>
                      <td>{ligne.etudiant.nom}</td>
                      <td>
                        <label className="case-presence">
                          <input
                            type="checkbox"
                            checked={absencesLocales[ligne.inscriptionId] ?? false}
                            onChange={() => basculerAbsence(ligne.inscriptionId)}
                          />
                          <span>Absent</span>
                        </label>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {lignes.length > 0 && (
              <button
                className="bouton-principal bouton-enregistrer"
                onClick={gererEnregistrement}
                disabled={enCoursEnregistrement}
              >
                {enCoursEnregistrement ? 'Enregistrement en cours...' : 'Enregistrer la présence'}
              </button>
            )}

            {confirmationVisible && <p className="message-confirmation">Présence enregistrée.</p>}
            {erreur && <p className="message-erreur-lot" role="alert">{erreur}</p>}
          </>
        )}
      </div>
    </div>
  );
}
