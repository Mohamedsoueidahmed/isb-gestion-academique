import { useState } from 'react';
import { saisirComposante } from '../../services/notes.service';
import type { TypeComposante } from '../../types/notes.types';

interface Props {
  inscriptionId: string;
  coursId: string;
  type: TypeComposante;
  valeurActuelle: number | null;
  onSauvegardee: () => void;
}

function validerValeur(texte: string): number | null | undefined {
  const nettoye = texte.trim();
  if (nettoye === '') return null;

  const nombre = Number(nettoye.replace(',', '.'));
  if (Number.isNaN(nombre) || nombre < 0 || nombre > 20) return undefined;

  return nombre;
}

/**
 * Une cellule = une composante (Devoir 1, Exposé, Examen S1...). La
 * sauvegarde d'une composante peut affecter la moyenne, le statut, et
 * même l'apparition de la colonne Session 2 pour cet étudiant — donc
 * onSauvegardee ne met pas à jour l'état localement, il déclenche un
 * rechargement de toute la ligne depuis le serveur (géré par le parent).
 */
export default function CelluleComposante({ inscriptionId, coursId, type, valeurActuelle, onSauvegardee }: Props) {
  const [valeur, setValeur] = useState(valeurActuelle != null ? String(valeurActuelle) : '');
  const [enCoursSauvegarde, setEnCoursSauvegarde] = useState(false);
  const [vientDetreSauvegardee, setVientDetreSauvegardee] = useState(false);
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);

  async function gererPerteFocus() {
    setErreurLocale(null);

    const valeurActuelleTexte = valeurActuelle != null ? String(valeurActuelle) : '';
    if (valeur === valeurActuelleTexte) return;

    const valeurValidee = validerValeur(valeur);
    if (valeurValidee === undefined) {
      setErreurLocale('0 à 20');
      return;
    }

    setEnCoursSauvegarde(true);
    try {
      await saisirComposante({ inscriptionId, coursId, type, valeur: valeurValidee });
      setVientDetreSauvegardee(true);
      setTimeout(() => setVientDetreSauvegardee(false), 1000);
      onSauvegardee();
    } catch (erreur: unknown) {
      const message =
        (erreur as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Échec de la sauvegarde';
      setErreurLocale(message);
    } finally {
      setEnCoursSauvegarde(false);
    }
  }

  const classesInput = [
    valeurActuelle == null && !vientDetreSauvegardee ? 'non-saisie' : 'saisie',
    vientDetreSauvegardee ? 'vient-d-etre-sauvegardee' : '',
    erreurLocale ? 'erreur' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="cellule-note">
      <input
        type="text"
        inputMode="decimal"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onBlur={gererPerteFocus}
        disabled={enCoursSauvegarde}
        className={classesInput}
        placeholder="—"
      />
      {erreurLocale && <div className="message-erreur-cellule">{erreurLocale}</div>}
    </div>
  );
}
