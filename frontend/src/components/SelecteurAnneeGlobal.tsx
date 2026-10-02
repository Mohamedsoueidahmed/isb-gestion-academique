import { useAnneeUniversitaire } from '../contexts/AnneeUniversitaireContext';
import './SelecteurAnneeGlobal.css';

export default function SelecteurAnneeGlobal() {
  const { annees, anneeSelectionneeId, setAnneeSelectionneeId, enChargement } = useAnneeUniversitaire();

  if (enChargement || annees.length === 0) {
    return null;
  }

  return (
    <select
      className="selecteur-annee-global"
      value={anneeSelectionneeId ?? ''}
      onChange={(e) => setAnneeSelectionneeId(e.target.value)}
      aria-label="Année universitaire affichée"
    >
      {annees.map((a) => (
        <option key={a.id} value={a.id}>
          {a.libelle}
        </option>
      ))}
    </select>
  );
}
