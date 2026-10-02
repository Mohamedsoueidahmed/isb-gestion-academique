import { useState } from 'react';
import type { FormEvent } from 'react';
import { modifierClasse } from '../../services/classes.service';
import type { Classe } from '../../types/classes.types';
import '../classes/PanneauCreationClasse.css';

interface Props {
  classe: Classe;
  onModifiee: (classe: Classe) => void;
  onAnnuler: () => void;
}

export default function PanneauModificationClasse({ classe, onModifiee, onAnnuler }: Props) {
  const [nom, setNom] = useState(classe.nom);
  const [effectifMax, setEffectifMax] = useState(classe.effectifMax ? String(classe.effectifMax) : '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function gererSoumission(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    if (!nom.trim()) {
      setErreur('Le nom est requis.');
      return;
    }

    setEnCours(true);
    try {
      const classeModifiee = await modifierClasse(classe.id, {
        nom: nom.trim(),
        effectifMax: effectifMax ? Number(effectifMax) : null,
      });
      onModifiee(classeModifiee);
    } catch (erreurModification: unknown) {
      const message =
        (erreurModification as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Une erreur est survenue lors de la modification.';
      setErreur(message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="superposition-panneau" onClick={onAnnuler}>
      <div className="panneau-creation" onClick={(e) => e.stopPropagation()}>
        <h2>Modifier la classe</h2>
        <p className="panneau-sous-titre">
          Seuls le nom et l'effectif sont modifiables ici. Pour corriger le parcours, le niveau,
          le semestre ou l'année, supprimez cette classe (si elle est vide) et recréez-la.
        </p>

        <form onSubmit={gererSoumission}>
          <div className="champ">
            <label htmlFor="nom">Nom de la classe</label>
            <input id="nom" type="text" value={nom} onChange={(e) => setNom(e.target.value)} disabled={enCours} autoFocus />
          </div>

          <div className="champ">
            <label htmlFor="effectif">Effectif maximum (optionnel)</label>
            <input
              id="effectif"
              type="number"
              min={1}
              value={effectifMax}
              onChange={(e) => setEffectifMax(e.target.value)}
              disabled={enCours}
            />
          </div>

          {erreur && <p className="message-erreur-panneau" role="alert">{erreur}</p>}

          <div className="boutons-panneau">
            <button type="submit" className="bouton-principal" disabled={enCours}>
              {enCours ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button type="button" className="bouton-secondaire" onClick={onAnnuler} disabled={enCours}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
