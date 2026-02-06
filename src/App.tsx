import React, { useState, useEffect, useRef } from 'react';
import { 
  Train, 
  Bike, 
  Users, 
  Plus, 
  Download, 
  LogOut, 
  BarChart3,
  Clock,
  User, 
  ChevronLeft,
  AlertCircle,
  Tag,
  Zap,
  ChevronRight,
  CheckCircle2,
  MapPin,
  Flag,
  Save,
  Minus,
  Activity,
  X,
  Share2,
  Trash2,
  MessageSquare,
  List,
  MapPinned,
  Search,
  CalendarDays,
  Info,
  Contact,
  Filter,
  Coffee,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  PlusCircle,
  Lock,
  UserCog,
  AlertTriangle,
  History,
  Pencil,
  FileText,
  Eye
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'railcount-pro-001';

// --- LEXIQUE DES GARES (VERROUILLÉ) ---
const STATION_NAMES = {
  "NS": "Nantes", "HAL": "Haluchère - Batignolles", "IBN": "Babinière",
  "EEA": "Erdre - Active", "HPC": "La Chapelle-Centre", "HPA": "La Chapelle-Aulnay",
  "UCE": "Sucé-sur-Erdre", "NSE": "Nort-sur-Erdre", "AAT": "Abbaretz",
  "ISE": "Issé", "CHU": "Châteaubriant", "ENB": "St Sébastien Pas-Enchantés",
  "LFD": "St Sébastien Frêne-Rond", "VT": "Vertou", "HFO": "La Haie-Fouassière",
  "PLL": "Le Pallet", "GOE": "Gorges", "CLI": "Clisson"
};

// --- CONFIGURATION DES DESSERTES ---
const STATION_SEQUENCES = {
  "NS-NSE": ["NS", "HAL", "IBN", "EEA", "HPC", "HPA", "UCE", "NSE"],
  "NS-CHU": ["NS", "HAL", "IBN", "EEA", "HPC", "HPA", "UCE", "NSE", "AAT", "ISE", "CHU"],
  "NS-CLI": ["NS", "ENB", "LFD", "VT", "HFO", "PLL", "GOE", "CLI"]
};

// --- HELPERS GLOBAUX ---
const getStations = (code) => {
  if (STATION_SEQUENCES[code]) return STATION_SEQUENCES[code];
  if (code && code.endsWith("-NS")) {
    const base = `NS-${code.split("-")[0]}`;
    if (STATION_SEQUENCES[base]) return [...STATION_SEQUENCES[base]].reverse();
  }
  return [];
};

const formatTimeStr = (s) => `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
const getCurrentTimeHHMM = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const getDayLabel = (dStr) => { 
  const d = new Date(dStr).getDay();
  return d === 0 ? "Dimanche" : d === 6 ? "Samedi" : "Lundi au Vendredi"; 
};

const formatDisplayDate = (dStr) => {
  if (!dStr) return "";
  const parts = dStr.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
};

const getPlanningDays = (startDate) => {
  const days = [];
  for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
  }
  return days;
};

// Helper pour vérifier la circulation (W=Semaine, S=Samedi, D=Dimanche)
const checkTrainCirculation = (trainData, dateStr) => {
    if (!trainData || !trainData.days) return true; // Pas de données, on suppose ok
    const day = new Date(dateStr).getDay(); // 0=Dim, 1=Lun...
    let code = "W";
    if (day === 0) code = "D";
    if (day === 6) code = "S";
    return trainData.days.includes(code);
};

// --- BASE DE DONNÉES TRAINS ---
const TRAIN_DATABASE = {
  // --- T2 NANTES -> CLISSON (NS-CLI) ---
  "859769": { dep: "06", min: "13", arr: "06:42", code: "NS-CLI", days: ["W"] },
  "859799": { dep: "06", min: "37", arr: "07:05", code: "NS-CLI", days: ["W"] },
  "859767": { dep: "07", min: "13", arr: "07:42", code: "NS-CLI", days: ["W"] },
  "859797": { dep: "07", min: "47", arr: "08:15", code: "NS-CLI", days: ["W", "S"] },
  "859765": { dep: "08", min: "13", arr: "08:44", code: "NS-CLI", days: ["W"] },
  "859795": { dep: "08", min: "38", arr: "09:05", code: "NS-CLI", days: ["W", "S", "D"] },
  "859763": { dep: "09", min: "13", arr: "09:42", code: "NS-CLI", days: ["W"] },
  "859793": { dep: "09", min: "39", arr: "10:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859741": { dep: "10", min: "39", arr: "11:07", code: "NS-CLI", days: ["S", "D"] },
  "859791": { dep: "11", min: "16", arr: "11:45", code: "NS-CLI", days: ["W", "S"] },
  "859739": { dep: "12", min: "09", arr: "12:37", code: "NS-CLI", days: ["D"] },
  "859761": { dep: "12", min: "13", arr: "12:42", code: "NS-CLI", days: ["W"] },
  "859787": { dep: "12", min: "39", arr: "13:06", code: "NS-CLI", days: ["W", "S", "D"] },
  "859759": { dep: "13", min: "13", arr: "13:42", code: "NS-CLI", days: ["W"] },
  "859785": { dep: "13", min: "39", arr: "14:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859789": { dep: "14", min: "13", arr: "14:41", code: "NS-CLI", days: ["W"] },
  "859783": { dep: "14", min: "39", arr: "15:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859757": { dep: "15", min: "13", arr: "15:42", code: "NS-CLI", days: ["W"] },
  "859737": { dep: "15", min: "36", arr: "16:04", code: "NS-CLI", days: ["W", "S", "D"] },
  "859755": { dep: "16", min: "13", arr: "16:42", code: "NS-CLI", days: ["W"] },
  "859779": { dep: "16", min: "39", arr: "17:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859753": { dep: "17", min: "13", arr: "17:42", code: "NS-CLI", days: ["W"] },
  "859777": { dep: "17", min: "39", arr: "18:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859751": { dep: "18", min: "13", arr: "18:42", code: "NS-CLI", days: ["W"] },
  "859775": { dep: "18", min: "39", arr: "19:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859749": { dep: "19", min: "13", arr: "19:42", code: "NS-CLI", days: ["W"] },
  "859773": { dep: "19", min: "39", arr: "20:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859747": { dep: "20", min: "13", arr: "20:42", code: "NS-CLI", days: ["W"] },
  "859781": { dep: "20", min: "39", arr: "21:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859745": { dep: "21", min: "13", arr: "21:42", code: "NS-CLI", days: ["W"] },
  "859743": { dep: "21", min: "39", arr: "22:07", code: "NS-CLI", days: ["W", "S", "D"] },
  "859771": { dep: "22", min: "39", arr: "23:07", code: "NS-CLI", days: ["W", "D"] },

  // --- T2 CLISSON -> NANTES (CLI-NS) ---
  "859798": { dep: "05", min: "53", arr: "06:20", code: "CLI-NS", days: ["W"] },
  "859766": { dep: "06", min: "17", arr: "06:44", code: "CLI-NS", days: ["W"] },
  "859796": { dep: "06", min: "53", arr: "07:20", code: "CLI-NS", days: ["W", "S"] },
  "859764": { dep: "07", min: "27", arr: "07:54", code: "CLI-NS", days: ["W"] },
  "859794": { dep: "07", min: "53", arr: "08:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859762": { dep: "08", min: "23", arr: "08:50", code: "CLI-NS", days: ["W"] },
  "859792": { dep: "08", min: "53", arr: "09:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859760": { dep: "09", min: "22", arr: "09:49", code: "CLI-NS", days: ["W"] },
  "859742": { dep: "09", min: "53", arr: "10:20", code: "CLI-NS", days: ["S", "D"] },
  "859790": { dep: "10", min: "23", arr: "10:50", code: "CLI-NS", days: ["W"] },
  "859748": { dep: "10", min: "56", arr: "11:23", code: "CLI-NS", days: ["S", "D"] },
  "859788": { dep: "11", min: "22", arr: "11:49", code: "CLI-NS", days: ["W"] },
  "859746": { dep: "11", min: "53", arr: "12:20", code: "CLI-NS", days: ["S", "D"] },
  "859758": { dep: "12", min: "22", arr: "12:49", code: "CLI-NS", days: ["W"] },
  "859786": { dep: "12", min: "53", arr: "13:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859756": { dep: "13", min: "22", arr: "13:49", code: "CLI-NS", days: ["W"] },
  "859784": { dep: "13", min: "53", arr: "14:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859782": { dep: "14", min: "53", arr: "15:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859780": { dep: "15", min: "53", arr: "16:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859778": { dep: "16", min: "53", arr: "17:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859754": { dep: "17", min: "22", arr: "17:49", code: "CLI-NS", days: ["W"] },
  "859776": { dep: "17", min: "53", arr: "18:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859752": { dep: "18", min: "22", arr: "18:49", code: "CLI-NS", days: ["W"] },
  "859774": { dep: "18", min: "53", arr: "19:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859750": { dep: "19", min: "19", arr: "19:46", code: "CLI-NS", days: ["W"] },
  "859772": { dep: "19", min: "53", arr: "20:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859770": { dep: "20", min: "53", arr: "21:20", code: "CLI-NS", days: ["W", "S", "D"] },
  "859768": { dep: "21", min: "45", arr: "22:12", code: "CLI-NS", days: ["D"] },

  // --- T1 NANTES -> NORT (NS-NSE) ---
  "859550": { dep: "05", min: "25", arr: "06:02", code: "NS-NSE", days: ["W"] },
  "859552": { dep: "06", min: "10", arr: "06:47", code: "NS-NSE", days: ["W"] },
  "859554": { dep: "07", min: "10", arr: "07:48", code: "NS-NSE", days: ["W", "S"] },
  "859556": { dep: "08", min: "10", arr: "08:47", code: "NS-NSE", days: ["W"] },
  "859580": { dep: "08", min: "10", arr: "08:46", code: "NS-NSE", days: ["D"] },
  "859572": { dep: "08", min: "35", arr: "09:12", code: "NS-NSE", days: ["W"] },
  "859500": { dep: "09", min: "10", arr: "09:47", code: "NS-NSE", days: ["W", "S"] },
  "859540": { dep: "10", min: "10", arr: "10:46", code: "NS-NSE", days: ["D"] },
  "859502": { dep: "11", min: "10", arr: "11:47", code: "NS-NSE", days: ["W"] },
  "859582": { dep: "11", min: "10", arr: "11:46", code: "NS-NSE", days: ["S"] },
  "859558": { dep: "12", min: "10", arr: "12:47", code: "NS-NSE", days: ["W"] },
  "859526": { dep: "12", min: "10", arr: "12:46", code: "NS-NSE", days: ["S", "D"] },
  "859504": { dep: "13", min: "10", arr: "13:47", code: "NS-NSE", days: ["W"] },
  "859528": { dep: "13", min: "10", arr: "13:47", code: "NS-NSE", days: ["S"] },
  "859592": { dep: "13", min: "10", arr: "13:46", code: "NS-NSE", days: ["D"] },
  "859560": { dep: "14", min: "10", arr: "14:47", code: "NS-NSE", days: ["W"] },
  "859590": { dep: "14", min: "10", arr: "14:46", code: "NS-NSE", days: ["D"] },
  "859506": { dep: "15", min: "10", arr: "15:47", code: "NS-NSE", days: ["W"] },
  "859530": { dep: "15", min: "10", arr: "15:46", code: "NS-NSE", days: ["S"] },
  "859562": { dep: "16", min: "10", arr: "16:47", code: "NS-NSE", days: ["W"] },
  "859532": { dep: "16", min: "10", arr: "16:46", code: "NS-NSE", days: ["S", "D"] },
  "859564": { dep: "17", min: "10", arr: "17:47", code: "NS-NSE", days: ["W", "S"] },
  "859584": { dep: "17", min: "10", arr: "17:46", code: "NS-NSE", days: ["D"] },
  "859508": { dep: "17", min: "47", arr: "18:26", code: "NS-NSE", days: ["W"] },
  "859561": { dep: "16", min: "52", arr: "17:29", code: "NSE-NS", days: ["W", "S"] },
  "859566": { dep: "18", min: "10", arr: "18:47", code: "NS-NSE", days: ["W"] },
  "859568": { dep: "19", min: "10", arr: "19:47", code: "NS-NSE", days: ["W", "S"] },
  "859586": { dep: "19", min: "10", arr: "19:46", code: "NS-NSE", days: ["S", "D"] },
  "859563": { dep: "17", min: "28", arr: "18:05", code: "NSE-NS", days: ["W"] },
  "859593": { dep: "17", min: "52", arr: "18:29", code: "NSE-NS", days: ["D"] },
  "859565": { dep: "18", min: "28", arr: "19:08", code: "NSE-NS", days: ["W"] },
  "859585": { dep: "18", min: "52", arr: "19:29", code: "NSE-NS", days: ["S"] },
  "859567": { dep: "19", min: "28", arr: "20:25", code: "NSE-NS", days: ["W"] },
  "859595": { dep: "19", min: "52", arr: "20:29", code: "NSE-NS", days: ["D"] },
  "859571": { dep: "20", min: "28", arr: "21:05", code: "NSE-NS", days: ["W"] },
  "859511": { dep: "20", min: "53", arr: "21:29", code: "NSE-NS", days: ["W", "S"] },
  "859589": { dep: "21", min: "52", arr: "22:29", code: "NSE-NS", days: ["D"] },
  "859510": { dep: "20", min: "10", arr: "20:47", code: "NS-NSE", days: ["W"] },
  "859536": { dep: "21", min: "10", arr: "21:46", code: "NS-NSE", days: ["S", "D"] },
  "859574": { dep: "21", min: "35", arr: "22:11", code: "NS-NSE", days: ["W"] },
  "859588": { dep: "22", min: "10", arr: "22:47", code: "NS-NSE", days: ["D"] },

  // --- T1 CHATEAUBRIANT -> NANTES (CHU-NS) ---
  "859601": { dep: "06", min: "21", arr: "07:29", code: "CHU-NS", days: ["W"] },
  "859603": { dep: "07", min: "21", arr: "08:29", code: "CHU-NS", days: ["W", "S"] },
  "859605": { dep: "09", min: "21", arr: "10:29", code: "CHU-NS", days: ["W"] },
  "859623": { dep: "09", min: "23", arr: "10:29", code: "CHU-NS", days: ["S"] },
  "859621": { dep: "10", min: "23", arr: "11:29", code: "CHU-NS", days: ["D"] },
  "859607": { dep: "12", min: "31", arr: "13:39", code: "CHU-NS", days: ["W"] },
  "859625": { dep: "13", min: "21", arr: "14:29", code: "CHU-NS", days: ["S"] },
  "859609": { dep: "14", min: "21", arr: "15:29", code: "CHU-NS", days: ["W", "D"] },
  "859627": { dep: "16", min: "23", arr: "17:29", code: "CHU-NS", days: ["D"] },
  "859611": { dep: "17", min: "21", arr: "18:29", code: "CHU-NS", days: ["W", "S"] },
  "859610": { dep: "17", min: "35", arr: "18:42", code: "NS-CHU", days: ["W"] }, 
  "859613": { dep: "18", min: "21", arr: "19:29", code: "CHU-NS", days: ["W", "D"] },
  "859615": { dep: "19", min: "21", arr: "20:29", code: "CHU-NS", days: ["W"] },
  "859629": { dep: "19", min: "23", arr: "20:29", code: "CHU-NS", days: ["S"] },
  "859641": { dep: "20", min: "21", arr: "21:29", code: "CHU-NS", days: ["D"] },
  "859600": { dep: "06", min: "35", arr: "07:12", code: "NS-CHU", days: ["W"] },
  "859602": { dep: "07", min: "35", arr: "08:42", code: "NS-CHU", days: ["W"] },
  "859620": { dep: "08", min: "10", arr: "09:15", code: "NS-CHU", days: ["S"] },
  "859640": { dep: "09", min: "10", arr: "10:15", code: "NS-CHU", days: ["D"] },
  "859604": { dep: "10", min: "10", arr: "11:17", code: "NS-CHU", days: ["W", "S"] },
  "859642": { dep: "11", min: "10", arr: "12:17", code: "NS-CHU", days: ["D"] },
  "859606": { dep: "12", min: "45", arr: "13:52", code: "NS-CHU", days: ["W"] },
  "859624": { dep: "14", min: "10", arr: "15:17", code: "NS-CHU", days: ["S"] },
  "859622": { dep: "15", min: "10", arr: "16:15", code: "NS-CHU", days: ["D"] },
  "859608": { dep: "16", min: "35", arr: "17:42", code: "NS-CHU", days: ["W"] },
  "859626": { dep: "18", min: "10", arr: "19:15", code: "NS-CHU", days: ["S"] },
  "859644": { dep: "18", min: "10", arr: "19:18", code: "NS-CHU", days: ["D"] },
  "859612": { dep: "18", min: "35", arr: "19:42", code: "NS-CHU", days: ["W"] },
  "859614": { dep: "19", min: "35", arr: "20:42", code: "NS-CHU", days: ["W"] },
  "859628": { dep: "20", min: "10", arr: "21:15", code: "NS-CHU", days: ["S"] },
  "859646": { dep: "20", min: "10", arr: "21:18", code: "NS-CHU", days: ["D"] },
  "859616": { dep: "22", min: "35", arr: "23:42", code: "NS-CHU", days: ["W"] },
};

// --- COMPOSANTS EXTERNES ---

const AutoSaveTimeInput = ({ value, onSave, className }) => {
  const [localValue, setLocalValue] = useState(value || '');
  useEffect(() => { setLocalValue(value || ''); }, [value]);
  const handleBlur = () => { if (localValue !== value) onSave(localValue); };
  return (
    <input 
      type="time" 
      value={localValue} 
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => { if(e.key === 'Enter') { e.target.blur(); } }}
      className={className}
    />
  );
};

// Composant pour l'historique agent
const AgentHistoryView = ({ missions, onDelete, onEdit }) => {
  const [viewingMission, setViewingMission] = useState(null);
  const myMissions = missions; // Déjà filtré en amont

  if (myMissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-stone-300 space-y-4 py-12">
          <div className="p-4 bg-stone-50 rounded-full"><History className="w-12 h-12 text-stone-200" /></div>
          <p className="text-xs font-bold uppercase tracking-widest">Aucun historique disponible</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      {myMissions.map((m) => (
        <div key={m.id} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{formatDisplayDate(m.date)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-black text-stone-800">{m.trainNumber}</span>
                  <span className="bg-blue-50 text-blue-600 text-[8px] font-bold px-2 py-0.5 rounded uppercase">{m.route}</span>
                </div>
             </div>
             <div className="flex gap-2">
                <button onClick={() => setViewingMission(m)} className="p-2 bg-stone-50 text-stone-400 rounded-xl hover:text-teal-500 hover:bg-teal-50 transition-colors" title="Voir les détails">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => onEdit(m)} className="p-2 bg-stone-50 text-stone-400 rounded-xl hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Modifier">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(m.id)} className="p-2 bg-stone-50 text-stone-400 rounded-xl hover:text-red-500 hover:bg-red-50 transition-colors" title="Supprimer">
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
          </div>
          <div className="flex gap-4 border-t border-stone-50 pt-2">
             <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-stone-300" />
                <span className="text-xs font-black text-stone-600">{m.paxTotalBoarding || 0}</span>
             </div>
             <div className="flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-stone-300" />
                <span className="text-xs font-black text-stone-600">{m.bikeTotalBoarding || 0}</span>
             </div>
             {m.observations && (
               <div className="ml-auto flex items-center gap-1.5 text-stone-300" title="Observations présentes">
                 <MessageSquare className="w-3.5 h-3.5" />
               </div>
             )}
          </div>
        </div>
      ))}

      {/* Modale de détails */}
      {viewingMission && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-4">
                  <div>
                      <h3 className="text-lg font-black text-stone-800 uppercase italic">Détail Flux</h3>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Train {viewingMission.trainNumber}</p>
                  </div>
                  <button onClick={() => setViewingMission(null)} className="p-2 bg-stone-100 rounded-full text-stone-400"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="overflow-y-auto rounded-xl border border-stone-100">
                  <table className="w-full text-left">
                      <thead className="bg-stone-50 text-[9px] font-black uppercase text-stone-400 sticky top-0">
                          <tr>
                              <th className="px-3 py-2">Gare</th>
                              <th className="px-2 py-2 text-center text-blue-500">M.</th>
                              <th className="px-2 py-2 text-center text-red-400">D.</th>
                              <th className="px-2 py-2 text-center text-teal-500">V.E</th>
                              <th className="px-2 py-2 text-center text-orange-400">V.S</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50 text-[10px] font-bold text-stone-600">
                          {viewingMission.stationDetails?.map((log, i) => (
                              <tr key={i}>
                                  <td className="px-3 py-2">{log.name}</td>
                                  <td className="px-2 py-2 text-center text-blue-600">+{log.paxIn}</td>
                                  <td className="px-2 py-2 text-center text-stone-400">-{log.paxOut}</td>
                                  <td className="px-2 py-2 text-center text-teal-600">+{log.bikeIn}</td>
                                  <td className="px-2 py-2 text-center text-stone-400">-{log.bikeOut}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PlanningCalendarView = ({ 
  isManager, 
  currentAgentId,
  planningViewDate,
  shiftPlanningView,
  planningData,
  editingDay,
  setEditingDay,
  updateDayStatus,
  updateDayTimes,
  addTrainToPlan,
  removeTrainFromPlan,
  launchMissionFromPlan
}) => {
  const [trainInputs, setTrainInputs] = useState({});

  const handleTrainInputChange = (dayStr, value) => {
      setTrainInputs(prev => ({ ...prev, [dayStr]: value.replace(/\D/g, '').slice(0, 6) }));
  };

  const handleAddTrain = (dayStr) => {
      const trainId = trainInputs[dayStr];
      if (trainId) {
          addTrainToPlan(currentAgentId, dayStr, trainId);
          setTrainInputs(prev => ({ ...prev, [dayStr]: '' }));
      }
  };

  return (
      <div className="flex flex-col h-full space-y-4 pb-2">
          <div className="flex items-center justify-between bg-stone-50 rounded-2xl p-2 border border-stone-100">
              <button onClick={() => shiftPlanningView(-7)} className="p-2 text-stone-400 hover:text-blue-600"><ArrowLeft className="w-4 h-4" /></button>
              <span className="text-xs font-black uppercase text-stone-600 tracking-wide">
                  {new Date(planningViewDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - {new Date(new Date(planningViewDate).getTime() + 6*24*60*60*1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              <button onClick={() => shiftPlanningView(7)} className="p-2 text-stone-400 hover:text-blue-600"><ArrowRight className="w-4 h-4" /></button>
          </div>

          <div className="space-y-3">
              {getPlanningDays(planningViewDate).map((dayStr) => {
                  const dayData = planningData[dayStr];
                  const isEditing = editingDay === dayStr;
                  const isToday = dayStr === new Date().toISOString().split('T')[0];
                  const dateObj = new Date(dayStr);
                  const inputVal = trainInputs[dayStr] || '';

                  return (
                      <div key={dayStr} className={`rounded-2xl border transition-all ${dayData ? (dayData.status === 'repos' ? 'bg-stone-50 border-stone-100' : 'bg-white border-blue-100 shadow-sm') : 'bg-white border-stone-100 border-dashed'}`}>
                          <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setEditingDay(isEditing ? null : dayStr)}>
                              <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black uppercase flex-col leading-none ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-stone-100 text-stone-400'}`}>
                                      <span>{dateObj.getDate()}</span>
                                      <span className="text-[7px] opacity-70">{dateObj.toLocaleDateString('fr-FR', { month: 'short' }).slice(0,3)}</span>
                                  </div>
                                  <div className="text-left">
                                      <p className="text-xs font-bold text-stone-800 capitalize">{dateObj.toLocaleDateString('fr-FR', { weekday: 'long' })}</p>
                                      <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                                          {!dayData ? "Non déclaré" : dayData.status === 'repos' ? "Repos" : `${dayData.startTime} - ${dayData.endTime}`}
                                      </p>
                                  </div>
                              </div>
                              {dayData?.status === 'service' && <Briefcase className="w-4 h-4 text-blue-500" />}
                              {dayData?.status === 'repos' && <Coffee className="w-4 h-4 text-stone-300" />}
                              {!dayData && <PlusCircle className="w-4 h-4 text-stone-200" />}
                          </div>

                          {isEditing && (
                              <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                                  <div className="border-t border-stone-100 pt-3 mb-3 flex gap-2">
                                      <button 
                                          onClick={() => updateDayStatus(currentAgentId, dayStr, 'repos')}
                                          className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border ${dayData?.status === 'repos' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-400 border-stone-100'}`}
                                      >
                                          <Coffee className="w-3 h-3" /> Repos
                                      </button>
                                      <button 
                                          onClick={() => updateDayStatus(currentAgentId, dayStr, 'service')}
                                          className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border ${dayData?.status === 'service' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-stone-400 border-stone-100'}`}
                                      >
                                          <Briefcase className="w-3 h-3" /> Service
                                      </button>
                                  </div>

                                  {dayData?.status === 'service' && (
                                      <div className="space-y-3">
                                          <div className="flex gap-2">
                                              <div className="flex-1 bg-stone-50 rounded-xl px-3 py-2 border border-stone-100">
                                                  <p className="text-[7px] font-black text-stone-300 uppercase">Prise</p>
                                                  <AutoSaveTimeInput 
                                                    value={dayData.startTime} 
                                                    onSave={(val) => updateDayTimes(currentAgentId, dayStr, 'startTime', val)} 
                                                    className="w-full bg-transparent font-bold text-xs outline-none text-stone-700" 
                                                  />
                                              </div>
                                              <div className="flex-1 bg-stone-50 rounded-xl px-3 py-2 border border-stone-100">
                                                  <p className="text-[7px] font-black text-stone-300 uppercase">Fin</p>
                                                  <AutoSaveTimeInput 
                                                    value={dayData.endTime} 
                                                    onSave={(val) => updateDayTimes(currentAgentId, dayStr, 'endTime', val)} 
                                                    className="w-full bg-transparent font-bold text-xs outline-none text-stone-700" 
                                                  />
                                              </div>
                                          </div>

                                          <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                                              <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2">Trains Affectés</p>
                                              {dayData.trains?.length > 0 ? (
                                                  <div className="space-y-2 mb-3">
                                                      {dayData.trains.map((t, idx) => (
                                                          <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-stone-100 shadow-sm">
                                                              <div className="text-left w-full">
                                                                  <div className="flex justify-between items-center w-full">
                                                                    <p className="text-xs font-black text-stone-800">{t.number}</p>
                                                                    {!t.manual && !checkTrainCirculation(TRAIN_DATABASE[t.number], dayStr) && (
                                                                        <div className="flex items-center gap-1 text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                                                                            <AlertTriangle className="w-3 h-3" />
                                                                            <span className="text-[7px] font-bold uppercase">Circulation ?</span>
                                                                        </div>
                                                                    )}
                                                                  </div>
                                                                  <p className={`text-[8px] font-bold ${t.manual ? 'text-stone-300 italic' : 'text-emerald-600'}`}>{t.route} • {t.time}</p>
                                                              </div>
                                                              <div className="flex items-center gap-2">
                                                                   {!isManager && (
                                                                      <button onClick={() => launchMissionFromPlan(dayStr, t)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Confirmer et lancer"><CheckCircle2 className="w-4 h-4" /></button>
                                                                   )}
                                                                   <button onClick={() => removeTrainFromPlan(currentAgentId, dayStr, idx)} className="p-1.5 text-red-300 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                                              </div>
                                                          </div>
                                                      ))}
                                                  </div>
                                              ) : (
                                                  <p className="text-[9px] italic text-stone-400 text-center py-2">Aucun train renseigné</p>
                                              )}
                                              
                                              <div className="flex gap-2">
                                                  <input 
                                                      type="text" 
                                                      placeholder="N° Train" 
                                                      value={inputVal}
                                                      onChange={(e) => handleTrainInputChange(dayStr, e.target.value)}
                                                      onKeyDown={(e) => {
                                                          if (e.key === 'Enter') {
                                                              e.preventDefault(); 
                                                              handleAddTrain(dayStr);
                                                          }
                                                      }}
                                                      className="flex-1 bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-300"
                                                  />
                                                  <button 
                                                      onClick={() => handleAddTrain(dayStr)} 
                                                      disabled={!inputVal} 
                                                      className="bg-blue-600 text-white p-1.5 rounded-lg disabled:opacity-50 disabled:bg-stone-300 transition-colors"
                                                  >
                                                      <Plus className="w-4 h-4" />
                                                  </button>
                                              </div>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  );
              })}
          </div>
      </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Agent State
  const [agentName, setAgentName] = useState('');
  const [agentID, setAgentID] = useState('');
  const [agentTab, setAgentTab] = useState('planning'); 
  const [trainNumber, setTrainNumber] = useState('859');
  const [route, setRoute] = useState('');
  const [missionTime, setMissionTime] = useState({ hh: '00', mm: '00' });
  const [missionDate, setMissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [boardingStation, setBoardingStation] = useState(''); 
  const [enginType, setEnginType] = useState('US'); 
  const [engin1, setEngin1] = useState('');
  const [engin2, setEngin2] = useState('');
  const [formError, setFormError] = useState('');
  const [validityWarning, setValidityWarning] = useState('');

  // Agent History Editing
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState(null);

  // Manager Auth & State
  const [managerId, setManagerId] = useState('');
  const [managerPwd, setManagerPwd] = useState('');
  const [managerAuthError, setManagerAuthError] = useState('');
  const [managerTab, setManagerTab] = useState('history'); 
  const [targetAgentID, setTargetAgentID] = useState(''); 

  // Planning State (Global)
  const [planningDocs, setPlanningDocs] = useState([]); 
  const [planningData, setPlanningData] = useState({}); 
  const [planningViewDate, setPlanningViewDate] = useState(new Date()); 
  const [editingDay, setEditingDay] = useState(null); 
  const [newTrainId, setNewTrainId] = useState(''); 

  // Counting logic
  const [currentMission, setCurrentMission] = useState(null);
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [onBoardPax, setOnBoardPax] = useState(0);
  const [onBoardBike, setOnBoardBike] = useState(0);
  const [garePaxIn, setGarePaxIn] = useState(0);
  const [garePaxOut, setGarePaxOut] = useState(0);
  const [gareBikeIn, setGareBikeIn] = useState(0);
  const [gareBikeOut, setGareBikeOut] = useState(0);

  // Summary States
  const [stationLogs, setStationLogs] = useState([]);
  const [arrivalTime, setArrivalTime] = useState('00:00');
  const [observations, setObservations] = useState('');

  // Manager Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMission, setSelectedMission] = useState(null);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');

  // Time & UI
  const [seconds, setSeconds] = useState(0);
  const [liveClock, setLiveClock] = useState(new Date());
  const timerRef = useRef(null);
  const clockRef = useRef(null);
  const [numpad, setNumpad] = useState({ open: false, target: '', tempValue: '' });
  const pressTimer = useRef(null);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // --- ACTIONS HISTORIQUE AGENT ---
  const handleAgentDeleteMission = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce relevé ?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'missions', id));
        showNotification("Relevé supprimé.");
      } catch (err) {
        console.error("Erreur suppression:", err);
      }
    }
  };

  const handleAgentEditMission = (mission) => {
    setEditingMission({ ...mission });
    setEditModalOpen(true);
  };

  const saveEditedMission = async () => {
    if (!editingMission) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'missions', editingMission.id);
      await updateDoc(docRef, {
        trainNumber: editingMission.trainNumber,
        route: editingMission.route,
        enginType: editingMission.enginType,
        engins: editingMission.engins,
        observations: editingMission.observations,
        arrivalTime: editingMission.arrivalTime
      });
      setEditModalOpen(false);
      setEditingMission(null);
      showNotification("Modifications enregistrées.");
    } catch (err) {
      console.error("Erreur update:", err);
      showNotification("Erreur lors de la modification.");
    }
  };


  // --- PLANNING HELPERS (FIRESTORE) ---
  const savePlanningDay = async (targetAgentId, dateStr, data) => {
      if (!targetAgentId) return;
      const docId = `${targetAgentId}_${dateStr}`;
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'planning', docId), {
              ...data,
              agentID: targetAgentId,
              date: dateStr,
              updatedAt: Date.now()
          });
      } catch (err) { console.error("Error saving planning:", err); }
  };

  const shiftPlanningView = (days) => {
      const newDate = new Date(planningViewDate);
      newDate.setDate(newDate.getDate() + days);
      setPlanningViewDate(newDate);
  };

  const updateDayStatus = (agentId, dateStr, status) => {
      const currentData = planningData[dateStr] || {};
      const newData = { 
          ...currentData,
          status, 
          startTime: status === 'service' ? (currentData.startTime || '08:00') : '', 
          endTime: status === 'service' ? (currentData.endTime || '16:00') : '', 
          trains: currentData.trains || []
      };
      savePlanningDay(agentId, dateStr, newData);
  };

  const updateDayTimes = (agentId, dateStr, field, value) => {
      const currentData = planningData[dateStr] || {};
      savePlanningDay(agentId, dateStr, { ...currentData, [field]: value });
  };

  const addTrainToPlan = (agentId, dateStr, trainIdInput) => {
      if (!trainIdInput || trainIdInput.trim() === '') return;
      
      const trainInfo = TRAIN_DATABASE[trainIdInput];
      const newTrain = {
          number: trainIdInput,
          route: trainInfo ? trainInfo.code : 'INCONNU',
          time: trainInfo ? `${trainInfo.dep}:${trainInfo.min}` : '00:00',
          manual: !trainInfo
      };

      const currentData = planningData[dateStr] || { status: 'service', startTime: '08:00', endTime: '16:00', trains: [] };
      const newTrains = [...(currentData.trains || []), newTrain];
      savePlanningDay(agentId, dateStr, { ...currentData, trains: newTrains });
  };

  const removeTrainFromPlan = (agentId, dateStr, index) => {
      const currentData = planningData[dateStr];
      if(!currentData) return;
      const newTrains = [...currentData.trains];
      newTrains.splice(index, 1);
      savePlanningDay(agentId, dateStr, { ...currentData, trains: newTrains });
  };

  const launchMissionFromPlan = (dateStr, train) => {
      setMissionDate(dateStr);
      setTrainNumber(train.number);
      setRoute(train.route);
      const [hh, mm] = train.time.split(':');
      setMissionTime({ hh: hh || '00', mm: mm || '00' });
      
      const stations = getStations(train.route);
      if(stations.length > 0) setBoardingStation(stations[0]);
      
      setAgentTab('counting');
  };

  // --- HANDLERS AGENT ---
  const handleTrainNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTrainNumber(val);
    setFormError('');
    if (val.length === 6) {
      const data = TRAIN_DATABASE[val];
      if (data) {
        setRoute(data.code);
        setMissionTime({ hh: data.dep, mm: data.min });
        setArrivalTime(data.arr || "00:00");
        const sts = getStations(data.code);
        setBoardingStation(sts[0] || '');
        setValidityWarning("");
      } else {
        const c4 = val[3], last = parseInt(val[5]), isEven = last % 2 === 0;
        let m = c4 === '5' ? (isEven ? "NS-NSE" : "NSE-NS") : c4 === '6' ? (isEven ? "NS-CHU" : "CHU-NS") : c4 === '7' ? (!isEven ? "NS-CLI" : "CLI-NS") : "NON RÉPERTORIÉ";
        setRoute(m);
        const sts = getStations(m);
        setBoardingStation(sts[0] || '');
        setArrivalTime("00:00");
        setValidityWarning("Note : Train non répertorié.");
      }
    }
  };

  const startMission = (e) => {
    e.preventDefault();
    if (trainNumber.length !== 6) return setFormError("ID Train Invalide");
    const stations = getStations(route);
    const startIdx = stations.indexOf(boardingStation);
    setCurrentMission({ trainNumber, route, time: `${missionTime.hh}:${missionTime.mm}`, date: missionDate, enginType, agentName, agentID, stations });
    setCurrentStationIndex(startIdx >= 0 ? startIdx : 0);
    setStationLogs([]);
    setOnBoardPax(0); setOnBoardBike(0); setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    setView('counting');
  };

  // --- AUTRES HANDLERS ---
  const nextStation = () => {
    const currentTotalPax = Math.max(0, onBoardPax + garePaxIn - garePaxOut);
    const currentTotalBike = Math.max(0, onBoardBike + gareBikeIn - gareBikeOut);
    const logEntry = {
      code: currentMission.stations[currentStationIndex],
      name: STATION_NAMES[currentMission.stations[currentStationIndex]] || currentMission.stations[currentStationIndex],
      paxIn: garePaxIn, paxOut: garePaxOut,
      bikeIn: gareBikeIn, bikeOut: gareBikeOut,
      timestamp: getCurrentTimeHHMM() 
    };
    setStationLogs(prev => [...prev, logEntry]);
    setOnBoardPax(currentTotalPax); setOnBoardBike(currentTotalBike);
    setGarePaxIn(0); setGareBikeIn(0);
    const nextIdx = currentStationIndex + 1;
    setCurrentStationIndex(nextIdx);
    if (nextIdx === currentMission.stations.length - 1) {
      setGarePaxOut(currentTotalPax); setGareBikeOut(currentTotalBike);
    } else { setGarePaxOut(0); setGareBikeOut(0); }
  };

  const proceedToSummary = () => {
    const logEntry = {
      code: currentMission.stations[currentStationIndex],
      name: STATION_NAMES[currentMission.stations[currentStationIndex]] || currentMission.stations[currentStationIndex],
      paxIn: garePaxIn, paxOut: garePaxOut,
      bikeIn: gareBikeIn, bikeOut: gareBikeOut,
      timestamp: getCurrentTimeHHMM()
    };
    setStationLogs(prev => [...prev, logEntry]);
    if (timerRef.current) clearInterval(timerRef.current);
    setView('summary');
  };

  const finalizeSave = async () => {
    if (engin1.length !== 3 || (enginType === 'UM' && engin2.length !== 3)) {
      setFormError("Composition moteur obligatoire (3 chiffres).");
      return;
    }

    const totalInPax = stationLogs.reduce((sum, log) => sum + (Number(log.paxIn) || 0), 0);
    const totalInBike = stationLogs.reduce((sum, log) => sum + (Number(log.bikeIn) || 0), 0);

    const missionData = { 
      ...currentMission, 
      enginType,
      engins: enginType === 'US' ? [`U53${engin1}`] : [`U53${engin1}`, `U53${engin2}`],
      stationDetails: stationLogs,
      paxFinal: onBoardPax + garePaxIn - garePaxOut,
      bikeFinal: onBoardBike + gareBikeIn - gareBikeOut,
      paxTotalBoarding: totalInPax,
      bikeTotalBoarding: totalInBike,
      arrivalTime,
      observations,
      duration: formatTimeStr(seconds),
      timestamp: Date.now(),
      agentUid: user?.uid || 'anon'
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'missions'), missionData);
      setView('agent_dashboard');
      resetMission();
      showNotification("Mission enregistrée !");
    } catch (err) { console.error("Save error:", err); }
  };

  const handleDelete = () => { resetMission(); setView('agent_dashboard'); };
  const resetMission = () => {
    setCurrentMission(null); setTrainNumber('859'); setRoute(''); setEngin1(''); setEngin2(''); setFormError('');
    setObservations(''); setStationLogs([]); setGarePaxIn(0); setGarePaxOut(0);
    setGareBikeIn(0); setGareBikeOut(0); setSeconds(0); setEnginType('US');
  };

  const handleShare = () => {
    const text = `CORAIL - Bilan Mission\nTrain: ${currentMission.trainNumber}\nMission: ${currentMission.route}\nComposition: ${enginType} U53${engin1}${engin2?'/'+engin2:''}\nArrivée: ${arrivalTime}\nDurée: ${formatTimeStr(seconds)}`;
    if (navigator.share) navigator.share({ title: 'Relevé CORAIL', text }).catch(console.error);
    else { showNotification("Copié dans le presse-papier !"); }
  };

  const handleExportCSV = (dataToExport, filename = "CORAIL_Export") => {
    if (!dataToExport || dataToExport.length === 0) return;
    const headers = ["Date", "Agent", "CP", "Train", "Mission", "EM", "Gare", "Heure", "Voy. M.", "Voy. D.", "Vél. E.", "Vél. S.", "Notes"];
    const rows = [];
    dataToExport.forEach(m => {
      const composition = `${m.enginType} ${(m.engins || []).join('/')}`;
      const dateStr = formatDisplayDate(m.date);
      const obs = (m.observations || "").replace(/;/g, ",").replace(/\n/g, " ");

      (m.stationDetails || []).forEach(log => {
        rows.push([
          dateStr,
          m.agentName || "---",
          m.agentID || "---",
          m.trainNumber || "---",
          m.route || "---",
          composition,
          log.name || "---",
          log.timestamp || "---",
          log.paxIn || 0,
          log.paxOut || 0,
          log.bikeIn || 0,
          log.bikeOut || 0,
          `"${obs}"`
        ]);
      });
    });

    const csvContent = "\uFEFF" + [ 
      headers.join(";"),
      ...rows.map(r => r.join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Fichier exporté avec succès !");
  };

  const handleStartPress = (target, isDisabled = false) => {
    if (isDisabled) return;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      let val = target === 'paxIn' ? garePaxIn : target === 'paxOut' ? garePaxOut : target === 'bikeIn' ? gareBikeIn : target === 'bikeOut' ? gareBikeOut : (target === 'onBoardPax' ? (onBoardPax + garePaxIn - garePaxOut) : (onBoardBike + gareBikeIn - gareBikeOut));
      setNumpad({ open: true, target, tempValue: String(val) });
    }, 600);
  };
  const handleEndPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const updateFromNumpad = () => {
    const val = parseInt(numpad.tempValue) || 0;
    if (numpad.target === 'paxIn') setGarePaxIn(val);
    if (numpad.target === 'paxOut') setGarePaxOut(val);
    if (numpad.target === 'bikeIn') setGareBikeIn(val);
    if (numpad.target === 'bikeOut') setGareBikeOut(val);
    if (numpad.target === 'onBoardPax') setOnBoardPax(val);
    if (numpad.target === 'onBoardBike') setOnBoardBike(val);
    setNumpad({ open: false, target: '', tempValue: '' });
  };

  const addToNumpad = (digit) => {
    setNumpad(prev => ({ ...prev, tempValue: prev.tempValue.length < 3 ? prev.tempValue + digit : prev.tempValue }));
  };

  // --- FIREBASE INIT & SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (err) { console.error("Firebase error:", err); }
    };
    initAuth();
    const unsubAuth = onAuthStateChanged(auth, setUser);
    setLoading(false);
    clockRef.current = setInterval(() => setLiveClock(new Date()), 1000);
    return () => { if (unsubAuth) unsubAuth(); clearInterval(clockRef.current); };
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'missions'), (s) => {
      const d = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMissions(d.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)));
    });
  }, [user]);

  useEffect(() => {
      if(!user) return;
      return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'planning'), (s) => {
          const docs = s.docs.map(doc => doc.data());
          setPlanningDocs(docs);
      });
  }, [user]);

  useEffect(() => {
      const effectiveId = view === 'agent_dashboard' ? agentID : targetAgentID;
      const filtered = planningDocs.filter(d => d.agentID === effectiveId);
      const map = {};
      filtered.forEach(d => { map[d.date] = d; });
      setPlanningData(map);
  }, [planningDocs, view, agentID, targetAgentID]);


  if (loading) return <div className="h-screen flex items-center justify-center bg-[#FDFCFB]"><Train className="w-12 h-12 text-blue-600 animate-bounce" /></div>;

  // --- RENDU VIEWS ---

  if (view === 'login') return (
    <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-4 font-sans text-stone-800 text-center leading-none">
      <div className="max-w-[400px] w-full bg-white p-8 rounded-[3.5rem] shadow-2xl border border-stone-100 flex flex-col items-center animate-in fade-in">
        <div className="text-center space-y-4 pt-2">
          <div className="inline-flex p-5 bg-blue-50 rounded-[2rem] border border-blue-100 shadow-inner transition-all hover:scale-105 active:scale-95"><Train className="w-12 h-12 text-blue-600" /></div>
          <h1 className="text-6xl font-black text-stone-800 tracking-tighter italic uppercase leading-none">CORAIL</h1>
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-[0.2em] px-2 opacity-70 leading-relaxed italic">Comptage Opérationnel et Regroupement des Affluences par Itinéraires et Lignes</p>
        </div>
        <div className="grid gap-4 mt-12 w-full">
          <button onClick={() => setView('agent_auth')} className="group flex items-center gap-5 w-full p-6 bg-stone-50 hover:bg-white rounded-[2.5rem] border border-transparent hover:border-blue-200 transition-all text-left shadow-sm active:scale-95">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg"><Users className="text-white w-6 h-6" /></div>
            <div><p className="text-stone-800 font-bold text-lg tracking-tight uppercase leading-none text-left">Espace Agent</p><p className="text-[9px] text-stone-400 uppercase font-bold tracking-widest mt-2 text-left">Saisie Terrain</p></div>
            <ChevronRight className="ml-auto w-5 h-5 text-stone-300" />
          </button>
          <button onClick={() => setView('manager_auth')} className="group flex items-center gap-5 w-full p-6 bg-stone-50 hover:bg-white rounded-[2.5rem] border border-transparent hover:border-teal-200 transition-all text-left shadow-sm active:scale-95">
            <div className="p-4 bg-teal-600 rounded-2xl shadow-lg"><BarChart3 className="text-white w-6 h-6" /></div>
            <div><p className="text-stone-800 font-bold text-lg tracking-tight uppercase leading-none text-left">Espace Manager</p><p className="text-[9px] text-stone-400 uppercase font-bold tracking-widest mt-2 text-left">Analyse Flux</p></div>
            <ChevronRight className="ml-auto w-5 h-5 text-stone-300" />
          </button>
        </div>
      </div>
    </div>
  );

  if (view === 'agent_auth') {
    const cpRegex = /^\d{7}[A-Za-z]$/;
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-4 font-sans text-stone-800 text-center leading-none">
        <div className="max-w-[400px] w-full bg-white p-10 rounded-[3.5rem] shadow-2xl border border-stone-100 flex flex-col items-center relative animate-in fade-in leading-none">
          <button onClick={() => setView('login')} className="absolute top-8 left-8 text-stone-300"><ChevronLeft className="w-8 h-8" /></button>
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mb-10 border-2 border-white shadow-xl shadow-blue-100"><User className="w-10 h-10 text-white" /></div>
          <h1 className="text-3xl font-black text-stone-800 mb-10 tracking-tight italic uppercase">Identification</h1>
          <form onSubmit={(e) => { e.preventDefault(); if(agentName && cpRegex.test(agentID)) setView('agent_dashboard'); }} className="w-full space-y-5">
            <input required value={agentName} onChange={e=>setAgentName(e.target.value)} placeholder="Nom - Prénom" className="w-full bg-stone-50 border-none rounded-[1.75rem] py-5.5 px-8 font-bold text-stone-800 outline-none focus:ring-2 ring-blue-50 transition-all shadow-inner" />
            <input required value={agentID} onChange={e=>setAgentID(e.target.value.toUpperCase())} placeholder="CP : 0123456X" maxLength={8} className={`w-full bg-stone-50 border-none rounded-[1.75rem] py-5.5 px-8 font-bold text-stone-800 outline-none focus:ring-2 ring-blue-50 transition-all shadow-inner ${agentID.length > 0 && !cpRegex.test(agentID) ? 'ring-red-100' : ''}`} />
            <button type="submit" disabled={!agentName || !cpRegex.test(agentID)} className={`w-full font-black py-6 rounded-[1.75rem] shadow-xl uppercase tracking-widest mt-4 text-xs ${agentName && cpRegex.test(agentID) ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-stone-100 text-stone-300'}`}>Me Connecter</button>
          </form>
          {agentID.length > 0 && !cpRegex.test(agentID) && <p className="mt-4 text-[9px] font-bold text-red-400 uppercase tracking-widest text-center leading-none">Format requis : 7 chiffres + 1 lettre</p>}
        </div>
      </div>
    );
  }

  if (view === 'manager_auth') {
    const handleManagerLogin = (e) => {
        e.preventDefault();
        if (managerId === "Superviseur Comptage" && managerPwd === "SVLO_1512") {
            setView('manager_dashboard');
            setManagerAuthError('');
        } else {
            setManagerAuthError("Identifiants incorrects");
        }
    };

    return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-4 font-sans text-stone-800 text-center leading-none">
        <div className="max-w-[400px] w-full bg-white p-10 rounded-[3.5rem] shadow-2xl border border-stone-100 flex flex-col items-center relative animate-in fade-in leading-none">
          <button onClick={() => setView('login')} className="absolute top-8 left-8 text-stone-300"><ChevronLeft className="w-8 h-8" /></button>
          <div className="w-20 h-20 bg-teal-600 rounded-[2rem] flex items-center justify-center mb-10 border-2 border-white shadow-xl shadow-teal-100"><Lock className="w-10 h-10 text-white" /></div>
          <h1 className="text-3xl font-black text-stone-800 mb-10 tracking-tight italic uppercase">Accès Manager</h1>
          <form onSubmit={handleManagerLogin} className="w-full space-y-5">
            <input required value={managerId} onChange={e=>setManagerId(e.target.value)} placeholder="Identifiant" className="w-full bg-stone-50 border-none rounded-[1.75rem] py-5.5 px-8 font-bold text-stone-800 outline-none focus:ring-2 ring-teal-50 transition-all shadow-inner" />
            <input required type="password" value={managerPwd} onChange={e=>setManagerPwd(e.target.value)} placeholder="Mot de passe" className="w-full bg-stone-50 border-none rounded-[1.75rem] py-5.5 px-8 font-bold text-stone-800 outline-none focus:ring-2 ring-teal-50 transition-all shadow-inner" />
            <button type="submit" disabled={!managerId || !managerPwd} className={`w-full font-black py-6 rounded-[1.75rem] shadow-xl uppercase tracking-widest mt-4 text-xs ${managerId && managerPwd ? 'bg-teal-600 text-white shadow-teal-200' : 'bg-stone-100 text-stone-300'}`}>Connexion</button>
          </form>
          {managerAuthError && <p className="mt-4 text-[9px] font-bold text-red-400 uppercase tracking-widest text-center leading-none animate-pulse">{managerAuthError}</p>}
        </div>
      </div>
    );
  }

  if (view === 'agent_dashboard') return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-4 font-sans text-stone-800 text-center leading-none">
      <div className="max-w-[400px] w-full bg-white p-6 rounded-[3rem] shadow-2xl border border-stone-100 flex flex-col items-center relative overflow-hidden animate-in fade-in leading-none min-h-[650px] max-h-[90vh]">
        <button onClick={() => setView('login')} className="absolute top-6 left-6 text-stone-300 transition-colors hover:text-stone-600"><LogOut className="w-6 h-6" /></button>
        
        <div className="mt-8 mb-6 text-center">
             <h2 className="text-xl font-black text-stone-800 uppercase italic tracking-tighter">Espace Agent</h2>
             <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">{agentName}</p>
        </div>

        <div className="flex w-full bg-stone-50 p-1.5 rounded-2xl mb-6 border border-stone-100">
            <button onClick={() => setAgentTab('planning')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${agentTab === 'planning' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-stone-100' : 'text-stone-400 hover:text-stone-600'}`}>
                <CalendarDays className="w-4 h-4" /> Planification
            </button>
            <button onClick={() => setAgentTab('counting')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${agentTab === 'counting' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-stone-100' : 'text-stone-400 hover:text-stone-600'}`}>
                <Train className="w-4 h-4" /> Comptage
            </button>
            <button onClick={() => setAgentTab('history')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${agentTab === 'history' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-stone-100' : 'text-stone-400 hover:text-stone-600'}`}>
                <History className="w-4 h-4" /> Historique
            </button>
        </div>

        <div className="w-full flex-1 overflow-y-auto no-scrollbar relative">
            {agentTab === 'planning' ? (
                <PlanningCalendarView 
                  isManager={false} 
                  currentAgentId={agentID}
                  planningViewDate={planningViewDate}
                  shiftPlanningView={shiftPlanningView}
                  planningData={planningData}
                  editingDay={editingDay}
                  setEditingDay={setEditingDay}
                  updateDayStatus={updateDayStatus}
                  updateDayTimes={updateDayTimes}
                  addTrainToPlan={addTrainToPlan}
                  removeTrainFromPlan={removeTrainFromPlan}
                  launchMissionFromPlan={launchMissionFromPlan}
                />
            ) : agentTab === 'history' ? (
              <AgentHistoryView 
                missions={missions.filter(m => m.agentID === agentID)}
                onDelete={handleAgentDeleteMission}
                onEdit={handleAgentEditMission}
              />
            ) : (
                <form onSubmit={startMission} className="w-full space-y-4 pb-2">
                  {planningData[missionDate]?.trains?.length > 0 && (
                      <div className="mb-4">
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest text-left mb-2 pl-2">Trains prévus ce jour</p>
                          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                              {planningData[missionDate].trains.map((t, idx) => (
                                  <button 
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        setTrainNumber(t.number);
                                        const syntheticEvent = { target: { value: t.number } };
                                        handleTrainNumberChange(syntheticEvent);
                                    }}
                                    className={`flex-shrink-0 px-4 py-3 rounded-2xl border flex flex-col items-start min-w-[100px] transition-all ${trainNumber === t.number ? 'bg-blue-600 border-blue-600 ring-2 ring-offset-1 ring-blue-200' : 'bg-white border-stone-200 hover:border-blue-300'}`}
                                  >
                                      <span className={`text-sm font-black ${trainNumber === t.number ? 'text-white' : 'text-stone-800'}`}>{t.number}</span>
                                      <span className={`text-[8px] font-bold uppercase ${trainNumber === t.number ? 'text-blue-100' : 'text-stone-400'}`}>{t.route} • {t.time}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  <input type="date" value={missionDate} onChange={e => setMissionDate(e.target.value)} className="w-full bg-stone-50 border-none rounded-2xl py-4.5 px-8 font-bold text-stone-800 outline-none shadow-inner" />
                  <div className="space-y-2 text-left leading-none">
                    <input type="text" required value={trainNumber} onChange={handleTrainNumberChange} placeholder="N° Train" className="w-full bg-stone-50 border-none rounded-2xl py-4.5 px-8 font-bold text-stone-800 outline-none focus:bg-white focus:ring-2 ring-blue-50 tracking-[0.1em] shadow-inner text-lg" />
                    <div className="mt-2 ml-4 text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2 italic">
                        <Activity className="w-3 h-3 text-blue-400" /> {getDayLabel(missionDate)}
                    </div>
                    {validityWarning && <div className="flex items-center gap-3 p-3 bg-orange-50 text-orange-600 rounded-xl text-[9px] font-black uppercase leading-none"><AlertCircle className="w-3 h-3" />{validityWarning}</div>}
                  </div>

                  <div className={`grid grid-cols-2 gap-3 transition-all duration-300 ${route || trainNumber.length >= 4 ? 'opacity-100 h-auto scale-100' : 'opacity-0 h-0 scale-95 overflow-hidden'}`}>
                     <div className="relative">
                        <Tag className="absolute left-4 top-4.5 w-4 h-4 text-stone-300" />
                        <input type="text" value={route} onChange={e => setRoute(e.target.value)} className="w-full bg-white border border-stone-100 rounded-2xl py-4.5 pl-12 pr-4 font-black text-stone-800 outline-none shadow-sm text-xs focus:ring-2 ring-blue-50" placeholder="Code" />
                     </div>
                     <div className="relative flex items-center bg-stone-50 border border-stone-100 rounded-2xl px-3 shadow-inner">
                        <Clock className="w-4 h-4 text-blue-400 mr-2" />
                        <input type="text" maxLength="2" value={missionTime.hh} onChange={e => setMissionTime({...missionTime, hh: e.target.value.replace(/\D/g, '')})} className="w-8 bg-white rounded border border-stone-100 text-center font-black text-stone-700 text-sm py-1" />
                        <span className="mx-1 font-bold text-stone-300 leading-none">:</span>
                        <input type="text" maxLength="2" value={missionTime.mm} onChange={e => setMissionTime({...missionTime, mm: e.target.value.replace(/\D/g, '')})} className="w-8 bg-white rounded border border-stone-100 text-center font-black text-stone-700 text-sm py-1" />
                     </div>
                  </div>

                  <div className={`relative transition-all duration-300 ${route ? 'opacity-100 h-auto scale-100' : 'opacity-0 h-0 scale-95 overflow-hidden'}`}>
                     <p className="text-[8px] font-black text-stone-300 uppercase tracking-widest text-left ml-4 mb-1">Départ :</p>
                     <div className="relative">
                        <MapPinned className="absolute left-4 top-4.5 w-4 h-4 text-blue-500" />
                        <select value={boardingStation} onChange={e => setBoardingStation(e.target.value)} className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl py-4.5 pl-12 pr-8 font-bold text-blue-800 outline-none focus:bg-white appearance-none cursor-pointer text-[10px] uppercase shadow-sm">
                           {getStations(route).map(code => <option key={code} value={code}>{STATION_NAMES[code] || code}</option>)}
                        </select>
                     </div>
                  </div>

                  <div className="bg-[#FAF9F6] border border-stone-100 rounded-3xl p-4 space-y-4 shadow-sm leading-none">
                    <div className="flex bg-stone-100 p-1.5 rounded-xl">
                      <button type="button" onClick={()=>setEnginType('US')} className={`flex-1 py-2.5 text-[9px] font-black rounded-lg transition-all ${enginType === 'US' ? 'bg-blue-600 text-white shadow-lg' : 'text-stone-400'}`}>US</button>
                      <button type="button" onClick={()=>setEnginType('UM')} className={`flex-1 py-2.5 text-[9px] font-black rounded-lg transition-all ${enginType === 'UM' ? 'bg-blue-600 text-white shadow-lg' : 'text-stone-400'}`}>UM</button>
                    </div>
                    <div className="flex flex-col gap-2 leading-none">
                       <div className="flex items-center bg-white rounded-xl border border-stone-100 overflow-hidden shadow-sm focus-within:ring-2 ring-blue-50">
                          <div className="bg-stone-50 px-4 py-2.5 text-[11px] font-black text-stone-300 border-r italic uppercase tracking-wider">U53</div>
                          <input type="text" maxLength="3" value={engin1} onChange={e => setEngin1(e.target.value.replace(/\D/g, ''))} placeholder="---" className="flex-1 px-4 py-2.5 text-sm font-black text-stone-800 outline-none bg-transparent" />
                       </div>
                      {enginType === 'UM' && (
                        <div className="flex items-center bg-white rounded-xl border border-stone-100 overflow-hidden shadow-sm focus-within:ring-2 ring-blue-50">
                          <div className="bg-stone-50 px-4 py-2.5 text-[11px] font-black text-stone-300 border-r italic uppercase tracking-wider leading-none">U53</div>
                          <input type="text" maxLength="3" value={engin2} onChange={e => setEngin2(e.target.value.replace(/\D/g, ''))} placeholder="---" className="flex-1 px-4 py-2.5 text-sm font-black text-stone-800 outline-none bg-transparent" />
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="submit" disabled={trainNumber.length !== 6 || !route} className={`w-full font-black py-6 rounded-[2rem] shadow-xl uppercase tracking-widest mt-4 ${trainNumber.length === 6 && route ? 'bg-blue-600 text-white shadow-blue-200 active:scale-95' : 'bg-stone-100 text-stone-200'}`}>Lancer la Mission</button>
                </form>
            )}
        </div>
        
        {/* Modale d'édition */}
        {editModalOpen && editingMission && (
          <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
             <div className="bg-white rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-lg font-black text-stone-800 uppercase italic">Modifier Mission</h3>
                   <button onClick={() => setEditModalOpen(false)} className="p-2 bg-stone-100 rounded-full text-stone-400"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-3">
                   <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">N° Train</p>
                      <input 
                        type="text" 
                        value={editingMission.trainNumber} 
                        onChange={(e) => setEditingMission({...editingMission, trainNumber: e.target.value})}
                        className="w-full bg-transparent font-black text-stone-800 outline-none"
                      />
                   </div>
                   <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Code Mission</p>
                      <input 
                        type="text" 
                        value={editingMission.route} 
                        onChange={(e) => setEditingMission({...editingMission, route: e.target.value})}
                        className="w-full bg-transparent font-black text-stone-800 outline-none"
                      />
                   </div>
                   <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Arrivée</p>
                      <input 
                        type="time" 
                        value={editingMission.arrivalTime} 
                        onChange={(e) => setEditingMission({...editingMission, arrivalTime: e.target.value})}
                        className="w-full bg-transparent font-black text-stone-800 outline-none"
                      />
                   </div>

                   {/* AJOUT: Gestion de la composition */}
                   <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2">Composition</p>
                      <div className="flex bg-white p-1 rounded-lg border border-stone-200 mb-2">
                        <button 
                          onClick={() => setEditingMission(prev => ({...prev, enginType: 'US', engins: [prev.engins?.[0] || 'U53']}))} 
                          className={`flex-1 text-[10px] font-black py-1.5 rounded transition-all ${editingMission.enginType === 'US' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-400'}`}
                        >US</button>
                        <button 
                          onClick={() => setEditingMission(prev => ({...prev, enginType: 'UM', engins: [prev.engins?.[0] || 'U53', prev.engins?.[1] || 'U53']}))} 
                          className={`flex-1 text-[10px] font-black py-1.5 rounded transition-all ${editingMission.enginType === 'UM' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-400'}`}
                        >UM</button>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center bg-white rounded border border-stone-200 px-2 py-1">
                           <span className="text-[9px] font-black text-stone-300 italic mr-1">U53</span>
                           <input 
                             type="text" 
                             maxLength="3" 
                             value={(editingMission.engins?.[0] || '').replace(/^U53/, '')} 
                             onChange={(e) => {
                                const newEngins = [...(editingMission.engins || [])];
                                newEngins[0] = `U53${e.target.value.replace(/\D/g, '')}`;
                                setEditingMission({...editingMission, engins: newEngins});
                             }}
                             className="w-full font-black text-stone-700 text-xs outline-none bg-transparent"
                           />
                        </div>
                        {editingMission.enginType === 'UM' && (
                          <div className="flex items-center bg-white rounded border border-stone-200 px-2 py-1">
                             <span className="text-[9px] font-black text-stone-300 italic mr-1">U53</span>
                             <input 
                               type="text" 
                               maxLength="3" 
                               value={(editingMission.engins?.[1] || '').replace(/^U53/, '')} 
                               onChange={(e) => {
                                  const newEngins = [...(editingMission.engins || [])];
                                  if (newEngins.length < 2) newEngins.push('U53');
                                  newEngins[1] = `U53${e.target.value.replace(/\D/g, '')}`;
                                  setEditingMission({...editingMission, engins: newEngins});
                               }}
                               className="w-full font-black text-stone-700 text-xs outline-none bg-transparent"
                             />
                          </div>
                        )}
                      </div>
                   </div>

                   <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Observations</p>
                      <textarea 
                        value={editingMission.observations} 
                        onChange={(e) => setEditingMission({...editingMission, observations: e.target.value})}
                        className="w-full bg-transparent font-medium text-stone-600 text-xs outline-none h-16 resize-none"
                      />
                   </div>
                </div>

                <button onClick={saveEditedMission} className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl text-xs shadow-lg active:scale-95 transition-transform">
                   Sauvegarder
                </button>
             </div>
          </div>
        )}

      </div>
    </div>
  );

  if (view === 'counting') {
    if (!currentMission) return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Chargement de la mission...</p>
      </div>
    );

    const totalStations = currentMission?.stations?.length || 0;
    const isTerminus = currentStationIndex === totalStations - 1;
    const isOrigin = currentStationIndex === 0;
    const fullName = STATION_NAMES[currentMission.stations[currentStationIndex]] || "Gare Inconnue";

    return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col font-sans text-stone-800 select-none animate-in fade-in leading-none">
        <header className="bg-white px-5 py-4 flex justify-between items-center border-b border-stone-100 shadow-sm relative z-20">
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">{String(currentMission.route)}</span>
              <span className="text-xl font-black tracking-tighter leading-none">{String(currentMission.trainNumber)}</span>
            </div>
            <div className="flex items-center gap-2 text-stone-800 mt-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-100 shadow-inner leading-none">
              <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
              <span className="text-[12px] font-black tabular-nums uppercase tracking-widest leading-none">
                {liveClock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
          <button onClick={proceedToSummary} className="bg-stone-50 border border-stone-100 text-stone-400 font-black text-[9px] uppercase px-4 py-2 rounded-xl active:scale-95 shadow-sm">RÉSUMÉ</button>
        </header>

        <section className="px-4 py-5 text-center">
           <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-lg flex items-center gap-5 relative overflow-hidden group">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600 shadow-inner transition-transform group-hover:scale-105"><MapPin className="w-8 h-8" /></div>
              <div className="text-left">
                 <p className="text-[9px] font-black text-stone-300 uppercase tracking-[0.4em] mb-1">STATION {String(currentStationIndex + 1)}/{String(totalStations)}</p>
                 <h2 className="text-xl font-black text-stone-800 tracking-tight italic leading-tight uppercase">{String(fullName)}</h2>
              </div>
           </div>
        </section>

        <div className="px-4 grid grid-cols-2 gap-4 mb-4 text-center">
           <div onMouseDown={() => handleStartPress('onBoardPax')} onMouseUp={handleEndPress} onTouchStart={() => handleStartPress('onBoardPax')} onTouchEnd={handleEndPress} className="bg-[#1A202C] rounded-[1.5rem] p-5 flex flex-col justify-center items-center shadow-xl relative overflow-hidden active:scale-95 transition-all">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 relative z-10 text-center leading-none">À BORD</p>
              <div className="flex items-center gap-2 relative z-10"><Users className="w-3.5 h-3.5 text-emerald-400" /><span className="text-white text-3xl tabular-nums font-black leading-none">{String(onBoardPax + garePaxIn - garePaxOut)}</span></div>
              <Users className="absolute bottom-[-15%] right-[-10%] w-16 h-16 text-white opacity-[0.03]" />
           </div>
           <div onMouseDown={() => handleStartPress('onBoardBike')} onMouseUp={handleEndPress} onTouchStart={() => handleStartPress('onBoardBike')} onTouchEnd={handleEndPress} className="bg-[#2B6CB0] rounded-[1.5rem] p-5 flex flex-col justify-center items-center shadow-xl relative overflow-hidden active:scale-95 transition-all">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 relative z-10 text-center leading-none">VÉLOS</p>
              <div className="flex items-center gap-2 relative z-10"><Bike className="w-3.5 h-3.5 text-white/50" /><span className="text-white text-3xl tabular-nums font-black leading-none">{String(onBoardBike + gareBikeIn - gareBikeOut)}</span></div>
              <Bike className="absolute bottom-[-15%] right-[-10%] w-16 h-16 text-white opacity-[0.03]" />
           </div>
        </div>

        <main className="flex-1 px-4 grid grid-cols-1 gap-4 mb-6 leading-none">
           <div className="flex gap-4 h-[180px] text-center">
              <div onMouseDown={() => handleStartPress('paxOut', isOrigin)} onMouseUp={handleEndPress} onTouchStart={() => handleStartPress('paxOut', isOrigin)} onTouchEnd={handleEndPress} className={`flex-1 bg-white rounded-[2.5rem] border shadow-xl flex flex-col overflow-hidden transition-all ${isOrigin ? 'opacity-40 grayscale pointer-events-none border-stone-100' : 'border-red-100 active:scale-95'}`}>
                 <div className={`flex-1 flex flex-col items-center justify-center p-2 ${isOrigin ? 'bg-stone-50/40' : 'bg-red-50/30'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isOrigin ? 'text-stone-300' : 'text-red-500'} leading-none`}>DESCENTES</p>
                    <p className={`text-7xl font-black leading-none tabular-nums tracking-tighter ${isOrigin ? 'text-stone-100' : 'text-stone-800'}`}>{String(garePaxOut)}</p>
                 </div>
                 <div className="grid grid-cols-2 h-16 border-t border-stone-100">
                    <button disabled={isOrigin} onClick={() => setGarePaxOut(m => Math.max(0, m - 1))} className="bg-stone-50/50 flex items-center justify-center border-r border-stone-100 active:bg-stone-200 transition-colors"><Minus className="w-8 h-8 text-stone-300" /></button>
                    <button disabled={isOrigin} onClick={() => setGarePaxOut(m => m + 1)} className={`flex items-center justify-center ${isOrigin ? 'bg-stone-50/50' : 'bg-red-500 text-white shadow-lg active:bg-red-600'}`}><Plus className="w-8 h-8" /></button>
                 </div>
              </div>
              <div onMouseDown={() => handleStartPress('paxIn', isTerminus)} onMouseUp={handleEndPress} onTouchStart={() => handleStartPress('paxIn', isTerminus)} onTouchEnd={handleEndPress} className={`flex-1 bg-white rounded-[2.5rem] border shadow-xl flex flex-col overflow-hidden transition-all ${isTerminus ? 'opacity-40 grayscale pointer-events-none border-stone-100' : 'border-emerald-100 active:scale-95 border-b-4 border-emerald-500/20'}`}>
                 <div className={`flex-1 flex flex-col items-center justify-center p-2 ${isTerminus ? 'bg-stone-50/40' : 'bg-emerald-50/30'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isTerminus ? 'text-stone-300' : 'text-emerald-500'} leading-none`}>MONTÉES</p>
                    <p className={`text-7xl font-black leading-none tabular-nums tracking-tighter ${isTerminus ? 'text-stone-100' : 'text-[#1A202C]'}`}>{String(garePaxIn)}</p>
                 </div>
                 <div className="grid grid-cols-2 h-16 border-t border-stone-100">
                    <button disabled={isTerminus} onClick={() => setGarePaxIn(m => Math.max(0, m - 1))} className="bg-stone-50/50 flex items-center justify-center border-r border-stone-100 transition-colors"><Minus className="w-8 h-8 text-stone-300" /></button>
                    <button disabled={isTerminus} onClick={() => setGarePaxIn(m => m + 1)} className={`flex items-center justify-center ${isTerminus ? 'bg-stone-50/50' : 'bg-emerald-500 text-white shadow-lg'}`}><Plus className="w-10 h-10" /></button>
                 </div>
              </div>
           </div>

           <div className="bg-[#2B6CB0] rounded-[2.5rem] p-6 flex flex-col justify-center shadow-2xl relative overflow-hidden group leading-none text-center">
              <div className="flex items-center gap-3 mb-2 text-left leading-none"><Bike className="w-5 h-5 text-white/50" /><span className="text-[10px] font-black text-white/50 uppercase tracking-widest">VÉLOS STATION</span></div>
              <div className="bg-white/5 rounded-3xl p-1 flex items-center justify-between border border-white/10 h-28 relative">
                 <div className={`flex-1 flex items-center justify-around px-2 transition-all duration-300 ${isOrigin ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
                    <button onClick={(e) => {e.stopPropagation(); setGareBikeOut(m => Math.max(0, m - 1))}} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/30 active:bg-white/10 shadow-inner"><Minus className="w-5 h-5" /></button>
                    <div onMouseDown={() => handleStartPress('bikeOut', isOrigin)} onMouseUp={handleEndPress} onTouchStart={() => handleStartPress('bikeOut', isOrigin)} onTouchEnd={handleEndPress} className="text-center px-1 active:scale-95 transition-all leading-none"><p className="text-[7px] font-black text-red-300 uppercase mb-1">SORTIES</p><p className="text-4xl font-black text-white tabular-nums">{String(gareBikeOut)}</p></div>
                    <button onClick={(e) => {e.stopPropagation(); setGareBikeOut(m => m + 1)}} className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white shadow-lg active:scale-90 border border-red-400/20"><Plus className="w-5 h-5" /></button>
                 </div>
                 <div className="w-px h-16 bg-white/10 mx-1"></div>
                 <div className={`flex-1 flex items-center justify-around px-2 transition-all duration-300 ${isTerminus ? 'opacity-10 grayscale pointer-events-none' : ''}`}>
                    <button onClick={(e) => {e.stopPropagation(); setGareBikeIn(m => Math.max(0, m - 1))}} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/30 active:bg-white/10 shadow-inner"><Minus className="w-5 h-5" /></button>
                    <div onMouseDown={() => handleStartPress('bikeIn', isTerminus)} onMouseUp={handleEndPress} onTouchStart={() => handleStartPress('bikeIn', isTerminus)} onTouchEnd={handleEndPress} className="text-center px-1 active:scale-95 transition-all leading-none"><p className="text-[7px] font-black text-emerald-300 uppercase mb-1">ENTRÉES</p><p className="text-4xl font-black text-white tabular-nums">{String(gareBikeIn)}</p></div>
                    <button onClick={(e) => {e.stopPropagation(); setGareBikeIn(m => m + 1)}} className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-xl active:scale-90 border border-emerald-400/20"><Plus className="w-5 h-5" /></button>
                 </div>
              </div>
           </div>
        </main>

        <footer className="px-4 pb-8 leading-none">
           <button onClick={isTerminus ? proceedToSummary : nextStation} className="w-full bg-[#1A202C] hover:bg-black text-white font-black py-8 rounded-[2.5rem] shadow-2xl flex items-center justify-center gap-4 active:scale-95 border-b-8 border-emerald-500/20 text-xs uppercase tracking-[0.4em]">
             {isTerminus ? "TERMINUS - RÉCAPITULATIF" : "Gare Suivante"} <ChevronRight className="w-6 h-6 text-emerald-400" />
           </button>
        </footer>

        {numpad.open && (
          <div className="fixed inset-0 z-50 bg-[#1A202C]/90 backdrop-blur-md flex items-end animate-in slide-in-from-bottom-full duration-300">
             <div className="w-full bg-white rounded-t-[3rem] p-8 pb-12 shadow-2xl">
                <div className="flex justify-between items-center mb-8 leading-none">
                   <h3 className="text-xl font-black uppercase text-stone-800 tracking-tight">Saisie Manuelle</h3>
                   <button onClick={() => setNumpad({...numpad, open: false})} className="p-4 bg-stone-100 rounded-full active:scale-90 transition-all shadow-inner"><X className="w-6 h-6 text-stone-400" /></button>
                </div>
                <div className="bg-stone-50 rounded-[2rem] p-8 mb-8 text-center border border-stone-100 shadow-inner"><span className="text-6xl font-black text-stone-800 tabular-nums">{String(numpad.tempValue || '0')}</span></div>
                <div className="grid grid-cols-3 gap-4">
                   {[1,2,3,4,5,6,7,8,9].map(d => <button key={d} onClick={() => addToNumpad(String(d))} className="bg-stone-50 h-16 rounded-2xl text-2xl font-black active:bg-blue-600 active:text-white transition-all shadow-sm">{d}</button>)}
                   <button onClick={() => setNumpad(p => ({...p, tempValue: ''}))} className="bg-stone-50 h-16 rounded-2xl text-lg font-black text-red-400 uppercase shadow-sm">C</button>
                   <button onClick={() => addToNumpad('0')} className="bg-stone-50 h-16 rounded-2xl text-2xl font-black shadow-sm">0</button>
                   <button onClick={updateFromNumpad} className="bg-emerald-500 h-16 rounded-2xl text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"><CheckCircle2 className="w-8 h-8" /></button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'summary') return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col font-sans text-stone-800 animate-in zoom-in-95 leading-none">
      <div className="flex-1 flex flex-col p-4 overflow-y-auto pb-4">
         <div className="bg-white p-6 rounded-[3rem] shadow-2xl border border-stone-100 space-y-6 flex flex-col relative overflow-hidden">
            <div className="text-center leading-none">
               <div className="inline-flex p-5 bg-emerald-50 rounded-2xl border border-emerald-100 mb-4 shadow-inner"><Flag className="w-8 h-8 text-emerald-500" /></div>
               <h1 className="text-3xl font-black text-stone-800 uppercase italic leading-none tracking-tight">Bilan Mission</h1>
               <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.3em] mt-2 italic text-center leading-none">Train {String(currentMission.trainNumber)}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 leading-none">
               <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 shadow-inner">
                  <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest mb-2 flex items-center gap-2 leading-none text-left"><Tag className="w-3.5 h-3.5 text-blue-400" /> Code Mission</p>
                  <input type="text" value={route} onChange={e => setRoute(e.target.value)} className="w-full bg-white border border-stone-100 rounded-lg p-2 font-black text-stone-800 text-lg shadow-sm outline-none text-center focus:ring-2 ring-blue-50 leading-none" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3 leading-none">
               <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 shadow-inner">
                  <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest mb-2 flex items-center gap-2 leading-none text-left"><Clock className="w-3.5 h-3.5 text-blue-400" /> Arrivée Terminus</p>
                  <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full bg-white border border-stone-100 rounded-lg p-2 font-black text-blue-600 text-lg shadow-sm outline-none text-center leading-none" />
               </div>

               <div className="bg-stone-50 p-3 rounded-2xl border border-stone-100 shadow-inner flex flex-col leading-none">
                  <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest mb-2 flex items-center gap-2 leading-none text-left"><Zap className="w-3.5 h-3.5 text-blue-400" /> Composition</p>
                  <div className="flex flex-col gap-2 leading-none">
                     <div className="flex bg-white/50 p-1 rounded-lg border border-stone-200">
                        <button onClick={() => setEnginType('US')} className={`flex-1 text-[8px] font-black py-1 rounded transition-all ${enginType === 'US' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-400'}`}>US</button>
                        <button onClick={() => setEnginType('UM')} className={`flex-1 text-[8px] font-black py-1 rounded transition-all ${enginType === 'UM' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-400'}`}>UM</button>
                     </div>
                     <div className="flex items-center bg-white rounded border border-stone-100 px-2 py-1 shadow-sm leading-none">
                        <span className="text-[9px] font-black text-stone-300 italic mr-1 leading-none">U53</span>
                        <input type="text" maxLength="3" value={engin1} onChange={e => setEngin1(e.target.value.replace(/\D/g, ''))} className="w-full font-black text-stone-700 text-sm outline-none bg-transparent shadow-none border-none p-0 h-auto leading-none text-center" placeholder="---" />
                     </div>
                     {enginType === 'UM' && (
                        <div className="flex items-center bg-white rounded border border-stone-100 px-2 py-1 shadow-sm animate-in fade-in slide-in-from-top-1 leading-none">
                           <span className="text-[9px] font-black text-stone-300 italic mr-1 leading-none">U53</span>
                           <input type="text" maxLength="3" value={engin2} onChange={e => setEngin2(e.target.value.replace(/\D/g, ''))} className="w-full font-black text-stone-700 text-sm outline-none bg-transparent shadow-none border-none p-0 h-auto leading-none text-center" placeholder="---" />
                        </div>
                     )}
                  </div>
               </div>
            </div>

            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-stone-100 shadow-sm leading-none">
               <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2 leading-none text-left"><MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Observations Diverses</p>
               <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Notez ici les particularités du trajet..." className="w-full h-24 bg-white rounded-xl p-3 text-xs font-medium border border-stone-100 outline-none shadow-inner resize-none text-left placeholder:text-stone-200 leading-tight" />
            </div>

            <div className="space-y-4 leading-none text-left">
               <div className="flex items-center gap-2 px-2 text-left leading-none"><List className="w-4 h-4 text-blue-500" /><h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest leading-none">Détail des flux par gare</h3></div>
               <div className="bg-stone-50 rounded-2xl overflow-hidden border border-stone-100 shadow-inner">
                  <table className="w-full text-left">
                     <thead className="bg-stone-100/50 text-[7px] font-black uppercase text-stone-300 border-b border-stone-200 leading-none">
                        <tr><th className="px-3 py-3 text-left">Gare</th><th className="px-1 py-3 text-center">Heure</th><th className="px-1 py-3 text-center text-blue-600">Mont. Voy.</th><th className="px-1 py-3 text-center text-red-400">Desc. Voy.</th><th className="px-1 py-3 text-center text-teal-400">Ent. Vél.</th><th className="px-1 py-3 text-center text-orange-400">Sor. Vél.</th></tr>
                     </thead>
                     <tbody className="divide-y divide-stone-100 leading-none">
                        {stationLogs.map((log, i) => (
                           <tr key={i} className="text-[10px] font-bold text-stone-600 leading-none">
                              <td className="px-3 py-3 leading-tight text-[8px] font-black text-stone-400 uppercase italic text-left">{String(log.name)}</td>
                              <td className="px-1 py-3 text-center text-[8px] font-black text-blue-600 tabular-nums">{String(log.timestamp)}</td>
                              <td className="px-1 py-3 text-center font-black text-blue-600">+{String(log.paxIn)}</td>
                              <td className="px-1 py-3 text-center text-stone-300">-{String(log.paxOut)}</td>
                              <td className="px-1 py-3 text-center font-black text-teal-600">+{String(log.bikeIn)}</td>
                              <td className="px-1 py-3 text-center text-stone-300">-{String(log.bikeOut)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 leading-none">
               <button onClick={finalizeSave} className="w-full bg-stone-900 text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 active:scale-95 border-b-4 border-emerald-500/20 text-xs uppercase tracking-widest">
                  <Save className="w-5 h-5 text-emerald-400" /> ENREGISTRER LA MISSION
               </button>
               <div className="grid grid-cols-2 gap-3 pb-6 leading-none">
                  <button onClick={handleShare} className="bg-blue-50 text-blue-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase active:scale-95 shadow-sm">
                    <Share2 className="w-4 h-4" /> Partager
                  </button>
                  <button onClick={handleDelete} className="bg-red-50 text-red-500 font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase active:scale-95 shadow-sm">
                    <Trash2 className="w-4 h-4" /> Annuler
                  </button>
               </div>
            </div>
            {formError && <p className="text-center text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse pb-4 leading-none">{String(formError)}</p>}
         </div>
      </div>
    </div>
  );

  if (view === 'manager_dashboard') {
    // Filter missions for History View
    const filteredMissions = missions.filter(m => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        String(m.trainNumber).toLowerCase().includes(q) || 
        String(m.route).toLowerCase().includes(q) || 
        (m.agentName || "").toLowerCase().includes(q) ||
        (m.agentID || "").toLowerCase().includes(q);
      const matchesAgentDropdown = selectedAgentFilter === 'all' || m.agentID === selectedAgentFilter;
      const matchesDate = !selectedDateFilter || m.date === selectedDateFilter;
      return matchesSearch && matchesAgentDropdown && matchesDate;
    });

    // Unique agents list for dropdown
    const uniqueAgents = Array.from(new Map(missions.map(m => [m.agentID, m.agentName])).entries());

    return (
      <div className="min-h-screen bg-[#FDFCFB] font-sans text-stone-800 text-center animate-in fade-in leading-none">
        <nav className="bg-white px-6 py-8 flex justify-between items-center border-b border-stone-100 sticky top-0 z-50 shadow-sm text-center">
          <div className="flex items-center gap-4 text-left leading-none"><div className="p-3 bg-teal-600 rounded-2xl shadow-lg shadow-teal-50"><BarChart3 className="w-6 h-6 text-white" /></div><div><span className="font-black text-2xl text-stone-800 tracking-tighter italic uppercase leading-none">CORAIL</span><span className="text-[8px] font-black text-teal-600 uppercase tracking-[0.4em] mt-1 block italic text-left leading-none">MONITORING</span></div></div>
          <button onClick={() => setView('login')} className="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white p-4 rounded-2xl transition-all border border-red-100 shadow-sm"><LogOut className="w-6 h-6" /></button>
        </nav>

        {/* Manager Tabs */}
        <div className="max-w-7xl mx-auto px-4 mt-8">
            <div className="flex bg-white p-1.5 rounded-[2rem] border border-stone-100 shadow-sm w-full md:w-96 mx-auto">
                <button onClick={() => setManagerTab('history')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${managerTab === 'history' ? 'bg-teal-600 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600'}`}>Historique</button>
                <button onClick={() => setManagerTab('planning')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${managerTab === 'planning' ? 'bg-teal-600 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600'}`}>Planning Équipes</button>
            </div>
        </div>

        {managerTab === 'planning' ? (
            <main className="max-w-2xl mx-auto p-4 leading-none mt-8">
                <div className="bg-white rounded-[3rem] p-8 shadow-2xl border border-stone-100">
                    <h2 className="text-xl font-black text-stone-800 uppercase italic tracking-tight mb-6">Gestion Planning</h2>
                    
                    <div className="bg-stone-50 p-4 rounded-3xl border border-stone-100 mb-8 flex flex-col gap-4">
                        <div className="flex items-center gap-3 px-2">
                            <UserCog className="w-5 h-5 text-teal-600" />
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Sélectionner un agent</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select 
                                value={targetAgentID} 
                                onChange={(e) => setTargetAgentID(e.target.value)}
                                className="w-full bg-white border border-stone-200 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 ring-teal-50"
                            >
                                <option value="">-- Choisir dans la liste --</option>
                                {uniqueAgents.map(([id, name]) => (
                                    <option key={id} value={id}>{name} ({id})</option>
                                ))}
                            </select>
                            <input 
                                type="text" 
                                placeholder="Ou saisir un matricule..." 
                                value={targetAgentID}
                                onChange={(e) => setTargetAgentID(e.target.value.toUpperCase())}
                                className="w-full bg-white border border-stone-200 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 ring-teal-50 uppercase placeholder:normal-case"
                            />
                        </div>
                    </div>

                    {targetAgentID ? (
                        <PlanningCalendarView 
                          isManager={true} 
                          currentAgentId={targetAgentID} 
                          planningViewDate={planningViewDate}
                          shiftPlanningView={shiftPlanningView}
                          planningData={planningData}
                          editingDay={editingDay}
                          setEditingDay={setEditingDay}
                          updateDayStatus={updateDayStatus}
                          updateDayTimes={updateDayTimes}
                          addTrainToPlan={addTrainToPlan}
                          removeTrainFromPlan={removeTrainFromPlan}
                          launchMissionFromPlan={launchMissionFromPlan}
                        />
                    ) : (
                        <div className="text-center py-12 opacity-50">
                            <UserCog className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Veuillez sélectionner un agent</p>
                        </div>
                    )}
                </div>
            </main>
        ) : (
            <main className="max-w-7xl mx-auto p-4 leading-none mt-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-center">
                 <div className="bg-white rounded-[2rem] p-8 border border-stone-100 shadow-xl flex flex-col items-center group transition-all hover:scale-105">
                    <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.4em] mb-4">Missions Archivées</p>
                    <p className="text-7xl font-black text-stone-800 tracking-tighter leading-none">{missions.length}</p>
                 </div>
                 <div className="bg-white rounded-[2rem] p-8 border border-stone-100 shadow-xl flex justify-between items-center group transition-all hover:scale-105">
                    <div className="text-left">
                       <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2 leading-none">Total Passagers</p>
                       <p className="text-5xl font-black text-stone-800 tracking-tighter">{String(filteredMissions.reduce((acc, m) => acc + (Number(m.paxTotalBoarding) || 0), 0))}</p>
                    </div>
                    <Users className="w-12 h-12 text-blue-50 transition-colors group-hover:text-blue-100" />
                 </div>
                 <div className="bg-white rounded-[2rem] p-8 border border-stone-100 shadow-xl flex justify-between items-center group transition-all hover:scale-105">
                    <div className="text-left leading-none">
                       <p className="text-[10px] font-black text-teal-500 uppercase tracking-[0.4em] mb-2 leading-none">Total Vélos</p>
                       <p className="text-5xl font-black text-stone-800 tracking-tighter leading-none">{String(filteredMissions.reduce((acc, m) => acc + (Number(m.bikeTotalBoarding) || 0), 0))}</p>
                    </div>
                    <Bike className="w-12 h-12 text-teal-50 transition-colors group-hover:text-teal-100" />
                 </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-2xl border border-stone-50 overflow-hidden mb-12">
                <div className="px-8 py-8 border-b border-stone-100 flex flex-col md:flex-row justify-between items-center bg-stone-50/30 gap-6">
                   <div className="flex flex-col md:flex-row gap-4 items-center w-full">
                      <button onClick={() => handleExportCSV(filteredMissions, "CORAIL_Historique")} disabled={filteredMissions.length === 0} className="bg-stone-900 hover:bg-black text-white px-6 py-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap">
                         <Download className="w-4 h-4 text-emerald-400" /> Exporter
                      </button>

                      <div className="relative w-full md:w-64 leading-none">
                         <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                         <select 
                           value={selectedAgentFilter}
                           onChange={e => setSelectedAgentFilter(e.target.value)}
                           className="w-full bg-white border border-stone-100 rounded-2xl py-4 pl-12 pr-8 text-xs font-bold shadow-sm appearance-none outline-none focus:ring-2 ring-blue-50 cursor-pointer"
                         >
                            <option value="all">Tous les agents</option>
                            {uniqueAgents.map(([id, name]) => (
                               <option key={id} value={id}>{name} ({id})</option>
                            ))}
                         </select>
                      </div>

                      <div className="relative w-full md:w-48 leading-none">
                        <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                        <input 
                          type="date" 
                          value={selectedDateFilter}
                          onChange={e => setSelectedDateFilter(e.target.value)}
                          className="w-full bg-white border border-stone-100 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold shadow-sm focus:ring-2 ring-blue-50 outline-none leading-none cursor-pointer"
                        />
                        {selectedDateFilter && (
                          <button 
                            onClick={() => setSelectedDateFilter('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-300 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="relative w-full md:w-64 leading-none ml-auto">
                        <Search className="absolute left-4 top-4 w-4 h-4 text-stone-300" />
                        <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white border border-stone-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold shadow-sm focus:ring-2 ring-blue-50 outline-none leading-none" />
                      </div>
                   </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead className="bg-stone-50/50 border-b border-stone-100 text-stone-300 uppercase font-black">
                      <tr>
                         <th className="px-8 py-6 text-left leading-none">Date</th>
                         <th className="px-8 py-6 text-left leading-none">Agent</th>
                         <th className="px-8 py-6 text-left leading-none">Train</th>
                         <th className="px-8 py-6 text-left leading-none">Mission</th>
                         <th className="px-8 py-6 text-center text-blue-600 leading-none">Voy.</th>
                         <th className="px-8 py-6 text-center text-teal-600 leading-none">Vél.</th>
                         <th className="px-8 py-6 text-center leading-none">Détail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredMissions.map(m => (
                        <tr key={m.id} className="hover:bg-stone-50/30 transition-all group border-l-4 border-transparent hover:border-blue-400">
                          <td className="px-8 py-6 font-bold text-stone-400 text-left italic">{formatDisplayDate(m.date)}</td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col text-left leading-none">
                               <span className="font-black text-stone-700 uppercase text-[10px]">{m.agentName || "Anonyme"}</span>
                               <span className="text-[8px] font-bold text-stone-300 mt-1">{m.agentID || "---"}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 font-black text-stone-800 text-left leading-none">{String(m.trainNumber)}</td>
                          <td className="px-8 py-6 font-bold text-stone-500 uppercase italic leading-none text-left leading-none">{String(m.route)}</td>
                          <td className="px-8 py-6 text-center font-black text-blue-600 leading-none">{String(m.paxTotalBoarding || 0)}</td>
                          <td className="px-8 py-6 text-center font-black text-teal-600 leading-none">{String(m.bikeTotalBoarding || 0)}</td>
                          <td className="px-8 py-6 text-center leading-none">
                             <button onClick={() => setSelectedMission(m)} className="p-3 bg-stone-50 rounded-xl text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-90 shadow-sm leading-none"><Info className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </main>
        )}

        {selectedMission && (
           <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 text-center">
              <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden leading-none">
                 <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-white sticky top-0 z-10 leading-none">
                    <div className="text-left leading-none">
                       <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2 leading-none">Détails du relevé</p>
                       <h3 className="text-2xl font-black text-stone-800 uppercase italic leading-none">Train {selectedMission.trainNumber}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                       <button 
                         onClick={() => handleExportCSV([selectedMission], `CORAIL_Train_${selectedMission.trainNumber}`)}
                         className="p-4 bg-emerald-50 text-emerald-600 rounded-full active:scale-90 transition-all shadow-inner border border-emerald-100"
                         title="Télécharger ce train"
                       >
                          <Download className="w-6 h-6" />
                       </button>
                       <button onClick={() => setSelectedMission(null)} className="p-4 bg-stone-50 rounded-full text-stone-400 active:scale-90 transition-all shadow-inner leading-none"><X className="w-6 h-6" /></button>
                    </div>
                 </div>

                 <div className="p-8 overflow-y-auto space-y-8 leading-none">
                    <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 shadow-sm flex items-center gap-6 text-left">
                       <div className="p-4 bg-white rounded-2xl shadow-sm border border-stone-100 leading-none"><Contact className="w-8 h-8 text-blue-500" /></div>
                       <div className="text-left leading-none">
                          <p className="text-[8px] font-black text-stone-300 uppercase tracking-widest mb-1">Agent de comptage</p>
                          <p className="text-xl font-black text-stone-800 uppercase leading-none">{selectedMission.agentName || "Anonyme"}</p>
                          <p className="text-[10px] font-bold text-blue-400 mt-1">Matricule : {selectedMission.agentID}</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left leading-none">
                       <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 shadow-sm leading-none">
                          <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest mb-2 flex items-center gap-2 text-left leading-none"><CalendarDays className="w-3 h-3" /> Date & Heure</p>
                          <p className="text-lg font-black text-stone-800 italic uppercase leading-none">{formatDisplayDate(selectedMission.date)}</p>
                          <p className="text-[10px] font-bold text-stone-400 mt-2 leading-none">Départ : {selectedMission.startTime || selectedMission.time}</p>
                          <p className="text-[10px] font-bold text-blue-400 mt-1 leading-none">Arrivée : {selectedMission.arrivalTime || "---"}</p>
                       </div>
                       <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 shadow-sm leading-none">
                          <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest mb-2 flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-blue-400" /> Composition</p>
                          <p className="text-lg font-black text-stone-800 italic uppercase leading-none">{selectedMission.enginType} {selectedMission.engins?.join(' / ')}</p>
                       </div>
                    </div>

                    <div className="bg-stone-50 rounded-2xl overflow-hidden border border-stone-100 shadow-inner">
                       <table className="w-full text-left text-[10px] leading-none">
                          <thead className="bg-stone-100 font-black uppercase text-stone-400 border-b border-stone-200 leading-none text-center">
                             <tr>
                                <th className="px-4 py-3 text-left">Gare</th>
                                <th className="px-2 py-3 text-center">Heure</th>
                                <th className="px-2 py-3 text-center text-blue-600">Voy. M.</th>
                                <th className="px-2 py-3 text-center text-red-600">Voy. D.</th>
                                <th className="px-2 py-3 text-center text-teal-600">Vél. E.</th>
                                <th className="px-2 py-3 text-center text-orange-600">Vél. S.</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 leading-none text-center">
                             {selectedMission.stationDetails?.map((log, i) => (
                                <tr key={i} className="font-bold text-stone-600 leading-none">
                                   <td className="px-4 py-3 uppercase text-[8px] font-black italic text-left leading-none">{log.name}</td>
                                   <td className="px-2 py-3 text-center tabular-nums leading-none">{log.timestamp}</td>
                                   <td className="px-2 py-3 text-center text-blue-600 leading-none">+{log.paxIn}</td>
                                   <td className="px-2 py-3 text-center text-red-400 leading-none">-{log.paxOut}</td>
                                   <td className="px-2 py-3 text-center text-teal-600 leading-none">+{log.bikeIn || 0}</td>
                                   <td className="px-2 py-3 text-center text-orange-500 leading-none">-{log.bikeOut || 0}</td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 <div className="p-8 bg-stone-50 border-t border-stone-100 flex justify-center gap-12 text-center leading-none">
                    <div className="text-center leading-none">
                       <p className="text-5xl font-black text-blue-600 tracking-tighter leading-none">{selectedMission.paxTotalBoarding || 0}</p>
                       <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest mt-2 leading-none">Cumul Voyageurs</p>
                    </div>
                    <div className="text-center leading-none">
                       <p className="text-5xl font-black text-teal-600 tracking-tighter leading-none">{selectedMission.bikeTotalBoarding || 0}</p>
                       <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest mt-2 leading-none">Cumul Vélos</p>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>
    );
  }

  return null;
};

export default App;