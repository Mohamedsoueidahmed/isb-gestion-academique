import { Fragment, useEffect, useState } from 'react';
import EnTete from '../../components/EnTete';
import { listerClasses } from '../../services/classes.service';
import { obtenirBulletinClasse, telechargerBulletinPdf, telechargerBulletinPdfEtudiant } from '../../services/bulletins.service';
import { LABELS_STATUT_VALIDATION, CLASSES_STATUT_VALIDATION, LABELS_COMPOSANTES, COLONNES_PAR_CYCLE } from '../../constants/notesConstants';
import { useAnneeUniversitaire } from '../../contexts/AnneeUniversitaireContext';
import type { Classe } from '../../types/classes.types';
import type { BulletinClasse } from '../../types/bulletins.types';
import '../../styles/listes.css';
import './BulletinPage.css';

export default function BulletinPage() {
  const { anneeSelectionneeId } = useAnneeUniversitaire();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [classeId, setClasseId] = useState('');
  const [bulletinClasse, setBulletinClasse] = useState<BulletinClasse | null>(null);
  const [indexEtudiant, setIndexEtudiant] = useState(0);

  const [chargementBulletin, setChargementBulletin] = useState(false);
  const [enCoursTelechargement, setEnCoursTelechargement] = useState(false);
  const [enCoursTelechargementEtudiant, setEnCoursTelechargementEtudiant] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setClasseId('');
    if (!anneeSelectionneeId) return;
    listerClasses({ anneeUniversitaireId: anneeSelectionneeId }).then(setClasses);
  }, [anneeSelectionneeId]);

  useEffect(() => {
    setBulletinClasse(null);
    setIndexEtudiant(0);

    if (!classeId) return;

    setChargementBulletin(true);
    setErreur(null);
    obtenirBulletinClasse(classeId)
      .then(setBulletinClasse)
      .catch(() => setErreur('Impossible de charger le bulletin de cette classe.'))
      .finally(() => setChargementBulletin(false));
  }, [classeId]);

  async function gererTelechargement() {
    if (!bulletinClasse) return;
    setEnCoursTelechargement(true);
    try {
      await telechargerBulletinPdf(classeId, bulletinClasse.classe.nom);
    } catch {
      setErreur('Impossible de télécharger le PDF.');
    } finally {
      setEnCoursTelechargement(false);
    }
  }

  async function gererTelechargementEtudiant() {
    if (!bulletinEtudiant) return;
    setEnCoursTelechargementEtudiant(true);
    try {
      await telechargerBulletinPdfEtudiant(classeId, bulletinEtudiant.etudiant.matricule);
    } catch {
      setErreur('Impossible de télécharger le PDF de cet étudiant.');
    } finally {
      setEnCoursTelechargementEtudiant(false);
    }
  }

  const bulletinEtudiant = bulletinClasse?.bulletins[indexEtudiant];

  const colonnesComposantesBase = bulletinClasse ? COLONNES_PAR_CYCLE[bulletinClasse.cycle] : [];
  // Même logique que le PDF (bulletins.pdf.ts) : la colonne Session 2
  // n'apparaît que si cet étudiant en a réellement besoin pour au moins un
  // cours, toutes UE confondues.
  const toutesLesLignes = bulletinEtudiant?.ue.flatMap((groupe) => groupe.cours) ?? [];
  const aBesoinSession2 = toutesLesLignes.some((ligne) => ligne.composantes.EXAMEN_SESSION_2 != null);
  const colonnesComposantes: (typeof colonnesComposantesBase)[number][] = aBesoinSession2
    ? [...colonnesComposantesBase, 'EXAMEN_SESSION_2']
    : colonnesComposantesBase;

  return (
    <div>
      <EnTete />
      <div className="page-contenu">
        <h1>Bulletins</h1>

        <div className="selecteurs-bulletin">
          <div className="champ-selecteur">
            <label htmlFor="classe">Classe</label>
            <select id="classe" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">Sélectionner une classe...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          {bulletinClasse && bulletinClasse.bulletins.length > 0 && (
            <div className="champ-selecteur">
              <label htmlFor="etudiant">Étudiant</label>
              <select
                id="etudiant"
                value={indexEtudiant}
                onChange={(e) => setIndexEtudiant(Number(e.target.value))}
              >
                {bulletinClasse.bulletins.map((b, i) => (
                  <option key={b.etudiant.matricule} value={i}>
                    {b.etudiant.nom} ({b.etudiant.matricule})
                  </option>
                ))}
              </select>
            </div>
          )}

          {bulletinClasse && (
            <button
              className="bouton-principal bouton-telecharger"
              onClick={gererTelechargement}
              disabled={enCoursTelechargement}
            >
              {enCoursTelechargement ? 'Téléchargement...' : 'Télécharger le PDF (toute la classe)'}
            </button>
          )}

          {bulletinEtudiant && (
            <button
              className="bouton-principal bouton-telecharger"
              onClick={gererTelechargementEtudiant}
              disabled={enCoursTelechargementEtudiant}
            >
              {enCoursTelechargementEtudiant ? 'Téléchargement...' : 'Télécharger le PDF (cet étudiant)'}
            </button>
          )}
        </div>

        {chargementBulletin && <p className="ligne-vide">Chargement...</p>}
        {erreur && <p className="ligne-vide" style={{ color: 'var(--couleur-erreur)' }}>{erreur}</p>}

        {!chargementBulletin && !erreur && bulletinClasse && bulletinClasse.bulletins.length === 0 && (
          <p className="ligne-vide">Aucun étudiant inscrit dans cette classe.</p>
        )}

        {!chargementBulletin && !erreur && bulletinEtudiant && (
          <>
            <div className="entete-bulletin-etudiant">
              <h2>{bulletinEtudiant.etudiant.nom}</h2>
              <span>{bulletinEtudiant.etudiant.matricule}</span>
            </div>

            <table className="tableau-liste tableau-bulletin">
              <thead>
                <tr>
                  <th>Cours</th>
                  {colonnesComposantes.map((type) => (
                    <th key={type}>{LABELS_COMPOSANTES[type]}</th>
                  ))}
                  <th>Moyenne</th>
                  <th>Statut</th>
                  <th>Absences</th>
                </tr>
              </thead>
              <tbody>
                {bulletinEtudiant.ue.map((groupe) => (
                  <Fragment key={groupe.ueCode}>
                    <tr
                      className={`ligne-groupe-ue ${
                        groupe.statutUE === 'VALIDEE'
                          ? 'ligne-groupe-ue-validee'
                          : groupe.statutUE === 'NON_VALIDEE'
                          ? 'ligne-groupe-ue-non-validee'
                          : ''
                      }`}
                    >
                      <td colSpan={1 + colonnesComposantes.length} style={{ textAlign: 'left' }}>
                        {groupe.ueCode} ({groupe.ueCredits} crédits)
                      </td>
                      <td>{groupe.moyenneUE ?? '—'}</td>
                      <td>{groupe.statutUE ? LABELS_STATUT_VALIDATION[groupe.statutUE] : '—'}</td>
                      <td></td>
                    </tr>
                    {groupe.cours.map((ligne) => (
                      <tr key={ligne.coursCode}>
                        <td>{ligne.coursTitre} ({ligne.coursCode})</td>
                        {colonnesComposantes.map((type) => (
                          <td key={type}>{ligne.composantes[type] ?? '—'}</td>
                        ))}
                        <td>{ligne.moyenne ?? '—'}</td>
                        <td>
                          {ligne.statutValidation ? (
                            <span className={`badge-statut ${CLASSES_STATUT_VALIDATION[ligne.statutValidation]}`}>
                              {LABELS_STATUT_VALIDATION[ligne.statutValidation]}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{ligne.nombreAbsences}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>

            <div
              className={`bandeau-moyenne-semestre ${
                bulletinEtudiant.statutSemestre === 'VALIDE'
                  ? 'bandeau-semestre-valide'
                  : bulletinEtudiant.statutSemestre === 'NON_VALIDE'
                  ? 'bandeau-semestre-non-valide'
                  : ''
              }`}
            >
              {bulletinEtudiant.moyenneSemestre != null
                ? `Moyenne du semestre : ${bulletinEtudiant.moyenneSemestre} / 20`
                : 'Moyenne du semestre : non calculable (une ou plusieurs UE incomplètes)'}
              {bulletinEtudiant.statutSemestre && (
                <span className="statut-semestre-texte">
                  {bulletinEtudiant.statutSemestre === 'VALIDE' ? 'Semestre validé' : 'Semestre non validé'}
                </span>
              )}
            </div>

            {(bulletinEtudiant.moyenneAnnuelle != null || bulletinEtudiant.statutPassage != null) && (
              <div
                className={`bandeau-moyenne-semestre ${
                  bulletinEtudiant.statutPassage === 'PASSAGE_ACCORDE'
                    ? 'bandeau-semestre-valide'
                    : bulletinEtudiant.statutPassage === 'PASSAGE_NON_ACCORDE'
                    ? 'bandeau-semestre-non-valide'
                    : ''
                }`}
                style={{ marginTop: 8 }}
              >
                {bulletinEtudiant.moyenneAnnuelle != null
                  ? `Moyenne annuelle : ${bulletinEtudiant.moyenneAnnuelle} / 20`
                  : 'Moyenne annuelle : non calculable'}
                {bulletinEtudiant.statutPassage && (
                  <span className="statut-semestre-texte">
                    {bulletinClasse?.estFinDeCycle
                      ? bulletinEtudiant.statutPassage === 'PASSAGE_ACCORDE'
                        ? 'Année validée'
                        : 'Année non validée'
                      : bulletinEtudiant.statutPassage === 'PASSAGE_ACCORDE'
                      ? 'Passage accordé'
                      : 'Passage non accordé'}
                  </span>
                )}
              </div>
            )}

            <p className="avertissement-bulletin">
              Les statuts affichés incluent la compensation entre UE, la validation de semestre, et, sur le
              bulletin du dernier semestre, la décision de passage à l'année suivante.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
