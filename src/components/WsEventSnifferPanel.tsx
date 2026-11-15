import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Eye,
  Film,
  Loader2,
  Play,
  Plus,
  PlugZap,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Unplug,
  Zap,
} from 'lucide-react';
import {
  BattleState,
  BOOSTERA_ASSETS,
  BOOSTERA_MUSIC_TRACKS,
  CameraPresetId,
  DiscoveredWsEventRecord,
  STANDALONE_SOUND_CUES,
  VfxAssetSpec,
  WsCollectedEventCategory,
  WsEventTriggerBinding,
  WsSpecialStageAction,
} from '../data/boosteraCatalog';
import { soundEngine } from '../engine/soundEngine';

interface WsEventSnifferPanelProps {
  battleState: BattleState;
  refreshState: () => Promise<void>;
  compact?: boolean;
}

interface StudioVisualGuideItem {
  id: string;
  shortTitleHe: string;
  visualWhatYouSeeHe: string;
  bestEventMatchHe: string;
}

const STUDIO_VIDEO_VISUAL_GUIDE: StudioVisualGuideItem[] = [
  {
    id: 'VID_02_CRYO_CO2_CANNONS',
    shortTitleHe: '#2 תותחי אדים / קיטור לבן (נראה כמו סילוני מים/קרח)',
    visualWhatYouSeeHe:
      'שני סילונים לבנים חזקים שמתפרצים בלחץ מהפינות התחתונות למעלה כמו תותחי קיטור/אדים קרים במופע ומתפוגגים באוויר.',
    bestEventMatchHe: 'קלף חשיפה (Boost Card), תיבת אוצר, גל שיתופים או כניסת VIP.',
  },
  {
    id: 'VID_01_FIREBALL_SNIPE_BLAST',
    shortTitleHe: '#1 סילון כדור-אש בליסטי ועשן',
    visualWhatYouSeeHe:
      'להביור וכדור אש כתום-לוהט שעף בעוצמה לרוחב החלק התחתון מאחורי המגיש עם שובל עשן דרמטי.',
    bestEventMatchHe: 'סנייפ בשניות הסיום או באנר מתנת-על גלובלית.',
  },
  {
    id: 'VID_03_TWIN_LIGHTNING_ARCS',
    shortTitleHe: '#3 עמודי ברק חשמליים כחולים-סגולים',
    visualWhatYouSeeHe:
      'ברקים חשמליים מתפצלים שמטפסים לאורך הקצה השמאלי והימני של המסך ומשאירים את הפנים נקיות במרכז.',
    bestEventMatchHe: 'פתיחת ענן ערפל של היריב (יחד עם רנטגן סקור!) או קומבו לייקים מהיר.',
  },
  {
    id: 'VID_04_COLD_SPARK_FOUNTAINS',
    shortTitleHe: '#4 מזרקות זיקוקי זהב קרים מ-4 פינות',
    visualWhatYouSeeHe:
      'מפלים של ניצוצות זהב יוקרתיים שיורדים מלמעלה ועולים מלמטה בפינות כמו במת גמר בטלוויזיה.',
    bestEventMatchHe: 'מנוי VIP / SuperFan חדש, הודעת Barrage מרחפת, או ניצחון בסיבוב.',
  },
  {
    id: 'VID_05_PK_FACTION_SMOKE_CLASH',
    shortTitleHe: '#5 עשן וברקים כחול מול אדום (זירת PK)',
    visualWhatYouSeeHe:
      'עמוד עשן כחול חשמלי משמאל מול עמוד עשן אדום-מגמה מימין — בדיוק בצבעי פס הקרב של טיקטוק.',
    bestEventMatchHe: 'פתיחת קרב PK חדש (Battle Start) או קרב צמוד.',
  },
  {
    id: 'VID_06_PLASMA_SPARK_SURGE',
    shortTitleHe: '#6 זרמי פלזמה טורקיז-כחול וניצוצות זהב',
    visualWhatYouSeeHe:
      'סרטי אנרגיה כחולים-זוהרים שעולים בשוליים ומתפוצצים בגלים של גיצים זהובים מהירים.',
    bestEventMatchHe: 'משימת מהירות בקרב (Battle Speed Task) או כפפת בוסט x5.',
  },
  {
    id: 'VID_07_QUAD_PYRO_FLAME_JETS',
    shortTitleHe: '#7 ארבעה תותחי להבות אש של במת הופעות',
    visualWhatYouSeeHe:
      'ארבעה עמודי אש אנכיים גבוהים שעולים משני צידי המגיש כמו במת פסטיבל ענקית.',
    bestEventMatchHe: 'מתנה בינונית (20–99 יהלומים), גראנד פינאלה או השלמת יעד חדר.',
  },
  {
    id: 'BEAST_08_VIOLET_PHOENIX',
    shortTitleHe: '#8 פניקס אסטרלי סגול פורש כנפיים',
    visualWhatYouSeeHe:
      'עוף חול סגול-מג׳נטה זוהר שמגיח מעל כתפי המגיש ופורש מוטת כנפיים ענקית מאחוריו.',
    bestEventMatchHe: 'מהפך יתרון לטובתנו בקרב (Lead Taken) או עלייה בדירוג השעתי.',
  },
  {
    id: 'BEAST_09_SOLAR_TIGER',
    shortTitleHe: '#9 טיגריס להבות שואג לתקיפה',
    visualWhatYouSeeHe:
      'טיגריס אש כתום-זהוב עוצמתי ששואג מאחורי הכתפיים ומקפיץ את האדרנלין בחדר.',
    bestEventMatchHe: 'פתיחת כפפת אגרוף x5 (Boosting Glove) ל-30 שניות.',
  },
  {
    id: 'BEAST_10_ROYAL_FIRE_LION',
    shortTitleHe: '#10 אריה האש המלכותי למתנות ענק',
    visualWhatYouSeeHe:
      'אריה בעל רעמת אש זהובה ששואג בהוד מלכותי בחלק העליון מאחורי המגיש.',
    bestEventMatchHe: 'מתנת לווייתן כבדה (Whale Gift 100+ יהלומים) וסנייפ ניצחון.',
  },
];

const CAMERA_OPTIONS: Array<{ value: CameraPresetId | 'NONE'; labelHe: string }> = [
  { value: 'NONE', labelHe: 'ללא תנועת מצלמה' },
  { value: 'ZOOM_PUNCH', labelHe: 'זום-פאנץ׳ אנרגטי (ZOOM_PUNCH)' },
  { value: 'EARTHQUAKE_SHAKE', labelHe: 'רעידת הדף קולנועית (EARTHQUAKE)' },
  { value: 'DUTCH_WHIP', labelHe: 'הטיה מהירה (DUTCH_WHIP)' },
  { value: 'BASS_PUMP', labelHe: 'פעימת באס קצבית (BASS_PUMP)' },
  { value: 'SNIPE_CREEP', labelHe: 'זחילת מתח ממוקדת (SNIPE_CREEP)' },
  { value: 'VACUUM_DROP', labelHe: 'שאיבת וואקום דרמטית (VACUUM_DROP)' },
  { value: 'STEADY_BREATH', labelHe: 'נשימת אולפן עדינה (STEADY)' },
];

const SPECIAL_ACTION_OPTIONS: Array<{ value: WsSpecialStageAction; labelHe: string }> = [
  { value: 'NONE', labelHe: 'ללא פעולה מיוחדת' },
  { value: 'CLOUD_XRAY', labelHe: 'רנטגן אנטי-ענן (חשיפת סקור מחדר היריב)' },
  { value: 'GLOVE_30S', labelHe: 'הפעלת מצב כפפה x5 ל-30 שניות' },
  { value: 'SNIPE_WINDOW', labelHe: 'דריכת חלון סנייפ קריטי' },
  { value: 'AVATAR_SPOTLIGHT', labelHe: 'זרקור אווטאר משתתף לבמה' },
  { value: 'TAP_BOOST_BANNER', labelHe: 'הקפצת באנר עידוד הקשות' },
];

const CATEGORY_TABS: Array<{ id: 'ALL' | 'SEEN_LIVE' | WsCollectedEventCategory; labelHe: string }> = [
  { id: 'ALL', labelHe: 'כל האירועים' },
  { id: 'SEEN_LIVE', labelHe: 'נתפסו חי ב-WS' },
  { id: 'CARDS_BOOSTS', labelHe: 'קלפים, כפפות וענן' },
  { id: 'BATTLE_PK', labelHe: 'קרבות ומשימות' },
  { id: 'GIFTS_DIAMONDS', labelHe: 'מתנות ויהלומים' },
  { id: 'CROWD_SOCIAL', labelHe: 'קהל, מנויים ו-VIP' },
  { id: 'RANKS_GOALS', labelHe: 'דירוגים ותיבות אוצר' },
  { id: 'EXTERNAL_CUSTOM', labelHe: 'מותאם / חיצוני' },
];

const EventSceneDiagram: React.FC<{ sceneTag?: string }> = ({ sceneTag }) => {
  switch (sceneTag) {
    case 'SMOKE_CLOUD':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#0D1524" />
          <rect x="8" y="14" width="28" height="8" rx="4" fill="#38BDF8" opacity="0.45" />
          <rect x="36" y="14" width="28" height="8" rx="4" fill="#FB7185" opacity="0.45" />
          <path
            d="M16 36 C16 27, 27 23, 34 27 C39 21, 52 23, 54 32 C60 33, 61 43, 53 45 L19 45 C11 44, 11 37, 16 36 Z"
            fill="#CBD5E1"
            opacity="0.88"
          />
          <text x="36" y="39" textAnchor="middle" fill="#0F172A" fontSize="11" fontWeight="bold">
            ???
          </text>
          <text x="36" y="60" textAnchor="middle" fill="#38BDF8" fontSize="9" fontWeight="bold">
            ענן סקור
          </text>
        </svg>
      );
    case 'GLOVE_X5':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#1C1308" />
          <circle cx="36" cy="30" r="18" fill="#F59E0B" opacity="0.22" />
          <rect x="22" y="18" width="28" height="22" rx="9" fill="#F59E0B" />
          <rect x="26" y="40" width="20" height="7" rx="3" fill="#B45309" />
          <text x="36" y="33" textAnchor="middle" fill="#0F172A" fontSize="12" fontWeight="900">
            x5
          </text>
          <text x="36" y="61" textAnchor="middle" fill="#FCD34D" fontSize="9" fontWeight="bold">
            כפפה 30s
          </text>
        </svg>
      );
    case 'SPEED_TASK':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#091926" />
          <circle cx="36" cy="29" r="14" stroke="#22D3EE" strokeWidth="3" fill="none" />
          <line x1="36" y1="29" x2="36" y2="21" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="36" y1="29" x2="43" y2="32" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="12" y="50" width="48" height="6" rx="3" fill="#1E293B" />
          <rect x="12" y="50" width="34" height="6" rx="3" fill="#22D3EE" />
          <text x="36" y="66" textAnchor="middle" fill="#67E8F9" fontSize="8.5" fontWeight="bold">
            משימת קרב
          </text>
        </svg>
      );
    case 'WHALE_GIFT':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#1E1108" />
          <polygon points="36,12 48,26 36,44 24,26" fill="#F59E0B" />
          <polygon points="36,12 48,26 36,29 24,26" fill="#FDE68A" />
          <text x="36" y="60" textAnchor="middle" fill="#FBBF24" fontSize="9" fontWeight="bold">
            מתנת ענק
          </text>
        </svg>
      );
    case 'GIFT_BOX':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#1A1024" />
          <rect x="20" y="26" width="32" height="22" rx="4" fill="#EC4899" />
          <rect x="18" y="21" width="36" height="7" rx="3" fill="#F472B6" />
          <rect x="34" y="21" width="4" height="27" fill="#FDE047" />
          <text x="36" y="61" textAnchor="middle" fill="#F9A8D4" fontSize="9" fontWeight="bold">
            מתנה בלייב
          </text>
        </svg>
      );
    case 'PK_START':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#0F1420" />
          <rect x="8" y="18" width="26" height="26" rx="5" fill="#0284C7" opacity="0.85" />
          <rect x="38" y="18" width="26" height="26" rx="5" fill="#E11D48" opacity="0.85" />
          <text x="36" y="35" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900">
            VS
          </text>
          <text x="36" y="60" textAnchor="middle" fill="#E2E8F0" fontSize="9" fontWeight="bold">
            זירת PK
          </text>
        </svg>
      );
    case 'TREASURE_BOX':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#1C1607" />
          <rect x="18" y="25" width="36" height="22" rx="5" fill="#D97706" />
          <path d="M18 27 Q36 15 54 27 Z" fill="#FBBF24" />
          <circle cx="36" cy="34" r="4" fill="#FEF08A" />
          <text x="36" y="60" textAnchor="middle" fill="#FDE047" fontSize="9" fontWeight="bold">
            תיבת אוצר
          </text>
        </svg>
      );
    case 'VIP_CROWN':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#191326" />
          <path d="M16 42 L20 22 L30 31 L36 18 L42 31 L52 22 L56 42 Z" fill="#FACC15" />
          <text x="36" y="60" textAnchor="middle" fill="#FDE047" fontSize="9" fontWeight="bold">
            VIP / דירוג
          </text>
        </svg>
      );
    case 'MOD_DELETE':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#1E1116" />
          <path d="M36 14 L52 20 V33 C52 43 44 49 36 52 C28 49 20 43 20 33 V20 Z" fill="#F43F5E" opacity="0.85" />
          <line x1="29" y1="27" x2="43" y2="41" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <line x1="43" y1="27" x2="29" y2="41" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <text x="36" y="63" textAnchor="middle" fill="#FDA4AF" fontSize="8.5" fontWeight="bold">
            ניקוי תגובה
          </text>
        </svg>
      );
    case 'GOAL_TARGET':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#0B1D19" />
          <circle cx="36" cy="31" r="15" stroke="#34D399" strokeWidth="3" fill="none" />
          <circle cx="36" cy="31" r="8" stroke="#34D399" strokeWidth="2.5" fill="none" />
          <circle cx="36" cy="31" r="3" fill="#A7F3D0" />
          <text x="36" y="60" textAnchor="middle" fill="#6EE7B7" fontSize="9" fontWeight="bold">
            יעד חדר
          </text>
        </svg>
      );
    case 'PUNISH_FINISH':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#171426" />
          <rect x="14" y="20" width="44" height="22" rx="6" fill="#F59E0B" />
          <text x="36" y="35" textAnchor="middle" fill="#0F172A" fontSize="11" fontWeight="900">
            WIN
          </text>
          <text x="36" y="60" textAnchor="middle" fill="#FCD34D" fontSize="8.5" fontWeight="bold">
            סיום קרב
          </text>
        </svg>
      );
    case 'SYSTEM_TELEMETRY':
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#0F141D" />
          <rect x="16" y="20" width="40" height="6" rx="3" fill="#334155" />
          <rect x="16" y="31" width="28" height="6" rx="3" fill="#475569" />
          <rect x="16" y="42" width="34" height="6" rx="3" fill="#334155" />
          <text x="36" y="61" textAnchor="middle" fill="#94A3B8" fontSize="8.5">
            רקע טכני
          </text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <rect width="72" height="72" rx="10" fill="#0D1929" />
          <rect x="10" y="21" width="52" height="20" rx="10" fill="#0EA5E9" opacity="0.3" stroke="#38BDF8" />
          <circle cx="21" cy="31" r="5" fill="#FDE047" />
          <rect x="30" y="28" width="24" height="5" rx="2.5" fill="#E0F2FE" />
          <text x="36" y="60" textAnchor="middle" fill="#7DD3FC" fontSize="8.5" fontWeight="bold">
            באנר קהל
          </text>
        </svg>
      );
  }
};

const BeastIllustratedPreview: React.FC<{ assetId: string }> = ({ assetId }) => {
  if (assetId === 'BEAST_08_VIOLET_PHOENIX') {
    return (
      <svg viewBox="0 0 160 90" className="w-full h-full">
        <rect width="160" height="90" fill="#140924" />
        <path
          d="M80 58 C62 34, 28 20, 14 34 C28 44, 48 50, 68 58 Z"
          fill="#C084FC"
          opacity="0.9"
        />
        <path
          d="M80 58 C98 34, 132 20, 146 34 C132 44, 112 50, 92 58 Z"
          fill="#E879F9"
          opacity="0.9"
        />
        <polygon points="80,22 87,56 80,68 73,56" fill="#F5D0FE" />
        <text x="80" y="82" textAnchor="middle" fill="#E9D5FF" fontSize="10" fontWeight="bold">
          פניקס סגול (מהפך יתרון)
        </text>
      </svg>
    );
  }
  if (assetId === 'BEAST_09_SOLAR_TIGER') {
    return (
      <svg viewBox="0 0 160 90" className="w-full h-full">
        <rect width="160" height="90" fill="#210E05" />
        <circle cx="80" cy="40" r="24" fill="#F97316" opacity="0.85" />
        <polygon points="62,22 68,8 75,20" fill="#FDBA74" />
        <polygon points="98,22 92,8 85,20" fill="#FDBA74" />
        <circle cx="72" cy="36" r="3" fill="#FEF08A" />
        <circle cx="88" cy="36" r="3" fill="#FEF08A" />
        <path d="M72 48 Q80 55 88 48" stroke="#1C1917" strokeWidth="3" fill="none" />
        <text x="80" y="82" textAnchor="middle" fill="#FED7AA" fontSize="10" fontWeight="bold">
          טיגריס אש (כפפה x5)
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 90" className="w-full h-full">
      <rect width="160" height="90" fill="#241205" />
      <circle cx="80" cy="40" r="28" fill="#D97706" opacity="0.45" />
      <circle cx="80" cy="40" r="20" fill="#F59E0B" />
      <polygon points="68,18 80,8 92,18" fill="#FEF08A" />
      <circle cx="73" cy="37" r="2.8" fill="#1C1917" />
      <circle cx="87" cy="37" r="2.8" fill="#1C1917" />
      <text x="80" y="82" textAnchor="middle" fill="#FDE68A" fontSize="10" fontWeight="bold">
        אריה אש מלכותי (לווייתן)
      </text>
    </svg>
  );
};

export const WsEventSnifferPanel: React.FC<WsEventSnifferPanelProps> = ({
  battleState,
  refreshState,
  compact = false,
}) => {
  const sniffer = battleState.wsSniffer;

  const [roomInput, setRoomInput] = useState<string>('');
  const [connectingRoom, setConnectingRoom] = useState<boolean>(false);
  const [scanningAutoLive, setScanningAutoLive] = useState<boolean>(false);

  const [extUrlInput, setExtUrlInput] = useState<string>('ws://localhost:21213/');
  const [connectingExt, setConnectingExt] = useState<boolean>(false);

  const [showVisualCatalog, setShowVisualCatalog] = useState<boolean>(!compact);
  const [brokenImgKeys, setBrokenImgKeys] = useState<Record<string, boolean>>({});

  const [activeCategory, setActiveCategory] = useState<'ALL' | 'SEEN_LIVE' | WsCollectedEventCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPayloadKey, setExpandedPayloadKey] = useState<string | null>(null);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [previewingVfxId, setPreviewingVfxId] = useState<string | null>(null);
  const [aiAssigning, setAiAssigning] = useState<boolean>(false);
  const [bannerHe, setBannerHe] = useState<string | null>(null);

  const [showNewCustomForm, setShowNewCustomForm] = useState<boolean>(false);
  const [newEventKey, setNewEventKey] = useState<string>('');
  const [newEventLabelHe, setNewEventLabelHe] = useState<string>('');

  const assetById = useMemo(() => {
    const map = new Map<string, VfxAssetSpec>();
    for (const a of BOOSTERA_ASSETS) {
      map.set(a.id, a);
    }
    return map;
  }, []);

  const filteredEvents = useMemo(() => {
    const list = sniffer?.discoveredEvents || [];
    const q = searchQuery.trim().toLowerCase();
    return list.filter((ev) => {
      if (activeCategory === 'SEEN_LIVE' && ev.seenCount <= 0) return false;
      if (activeCategory !== 'ALL' && activeCategory !== 'SEEN_LIVE' && ev.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        ev.eventKey.toLowerCase().includes(q) ||
        ev.labelHe.toLowerCase().includes(q) ||
        (ev.whatHappensInLiveHe || '').toLowerCase().includes(q) ||
        ev.lastSampleSummaryHe.toLowerCase().includes(q)
      );
    });
  }, [sniffer?.discoveredEvents, activeCategory, searchQuery]);

  const handleUpdateConfig = async (patch: {
    snifferActive?: boolean;
    autoExecuteBoundTriggers?: boolean;
    globalScopeOverride?: 'RESPECT_BINDING' | 'ALL_CONNECTED_SOCKETS' | 'MIRRORED_ONLY';
    resetCounters?: boolean;
  }) => {
    await fetch('/api/ws-sniffer/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await refreshState();
  };

  const handlePreviewStudioVideoOnStage = async (effectId: string, titleHe: string) => {
    soundEngine.ensureInitialized();
    setPreviewingVfxId(effectId);
    try {
      await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effectId, user: 'תצוגת_וידאו', bypassCooldown: true }),
      });
      await refreshState();
      setBannerHe(`הופעל עכשיו על במת ה-9:16: ${titleHe}`);
    } finally {
      setPreviewingVfxId(null);
    }
  };

  const handleConnectTikTokRoom = async () => {
    const clean = roomInput.trim().replace(/^@+/, '');
    if (!clean) {
      setBannerHe('הזן שם משתמש בטיקטוק להתחברות WebSocket ישירה או לחץ על סריקה אוטומטית לחדרים חיים.');
      return;
    }
    setConnectingRoom(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/tiktok/connect-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: clean,
          listenMode: 'MY_BROADCAST',
          mirrorToStage: true,
        }),
      });
      const json = await resp.json();
      await refreshState();
      if (json.connected) {
        setRoomInput('');
        setBannerHe(`מחובר חי ב-WebSocket אל @${clean} — מזהה ואוסף את כל האירועים והתמונות בזמן אמת!`);
      } else {
        setBannerHe(json.errorHe || `@${clean} אינו בלייב כרגע — נוסף למעקב אוטומטי.`);
      }
    } catch {
      setBannerHe('שגיאת תקשורת בחיבור לחדר השידור.');
    } finally {
      setConnectingRoom(false);
    }
  };

  const handleScanAndConnectLiveSockets = async () => {
    setScanningAutoLive(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/tiktok/connect-all-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeGlobalTop: true }),
      });
      const json = await resp.json();
      await refreshState();
      const liveList: string[] = json.currentlyLive || [];
      if (liveList.length > 0) {
        setBannerHe(
          `מחובר עכשיו ב-WebSocket חי ל-${liveList.length} חדרים (${liveList
            .slice(0, 4)
            .map((u) => '@' + u)
            .join(', ')}) — קולט אירועים ותמונות בזמן אמת!`
        );
      } else {
        setBannerHe('בוצעה סריקת חדרים; ברגע שחדר פעיל עולה ללייב קליטת ה-WebSocket תתחיל מיד.');
      }
    } catch {
      setBannerHe('שגיאה בסריקת WebSockets חיים.');
    } finally {
      setScanningAutoLive(false);
    }
  };

  const handleConnectExternalWs = async (presetUrl?: string) => {
    const targetUrl = (presetUrl ?? extUrlInput).trim();
    if (!targetUrl) return;
    setConnectingExt(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/ws-sniffer/connect-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const json = await resp.json();
      await refreshState();
      if (!resp.ok) {
        setBannerHe(json.error || 'כתובת WebSocket לא תקינה.');
      } else {
        setBannerHe(
          json.mode === 'BROWSER_LOCAL'
            ? `נפתח חיבור WebSocket מקומי מהדפדפן אל ${targetUrl} — כל אירוע ייקלט וישובץ אוטומטית!`
            : `נפתח חיבור WebSocket ישיר אל ${targetUrl}!`
        );
      }
    } catch {
      setBannerHe('שגיאה בחיבור לגשר WebSocket חיצוני.');
    } finally {
      setConnectingExt(false);
    }
  };

  const handleDisconnectExternalWs = async (url: string) => {
    await fetch('/api/ws-sniffer/disconnect-external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    await refreshState();
  };

  const handlePatchBinding = async (eventKey: string, patch: Partial<WsEventTriggerBinding>) => {
    setSavingKey(eventKey);
    try {
      await fetch('/api/ws-sniffer/update-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventKey, binding: patch }),
      });
      await refreshState();
    } finally {
      setSavingKey(null);
    }
  };

  const handleTestBinding = async (rec: DiscoveredWsEventRecord) => {
    soundEngine.ensureInitialized();
    setTestingKey(rec.eventKey);
    try {
      const resp = await fetch('/api/ws-sniffer/test-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventKey: rec.eventKey }),
      });
      const json = await resp.json();
      await refreshState();
      if (json.summaryHe) {
        setBannerHe(`הופעלה בדיקה חיה על הבמה עבור "${rec.labelHe}": ${json.summaryHe}`);
      } else {
        setBannerHe(`בחר לפחות אפקט, מצלמה, סאונד או פעולה מיוחדת עבור "${rec.labelHe}" ואז לחץ בדוק בבמה.`);
      }
    } finally {
      setTestingKey(null);
    }
  };

  const handleAiAutoAssign = async (singleEventKey?: string) => {
    setAiAssigning(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/ws-sniffer/ai-auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(singleEventKey ? { eventKey: singleEventKey } : {}),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setBannerHe(`ה-AI ניתח ושיבץ הפעלות במה אוטומטיות ל-${json.updatedCount || 1} אירועי WebSocket!`);
      } else {
        setBannerHe(json.error || 'שגיאה בשיבוץ אוטומטי חכם.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת בשיבוץ AI.');
    } finally {
      setAiAssigning(false);
    }
  };

  const handleCreateCustomEvent = async () => {
    const k = newEventKey.trim();
    if (!k) return;
    await fetch('/api/ws-sniffer/update-binding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventKey: k,
        labelHe: newEventLabelHe.trim() || `אירוע מותאם (${k})`,
        binding: {
          enabled: true,
          vfxId: 'VID_02_CRYO_CO2_CANNONS',
          cameraPreset: 'ZOOM_PUNCH',
          soundCueId: 'SND_HYPE_STADIUM_CHEER',
        },
      }),
    });
    setNewEventKey('');
    setNewEventLabelHe('');
    setShowNewCustomForm(false);
    await refreshState();
    setBannerHe(`נוסף אירוע WebSocket "${k}" עם הפעלה אוטומטית!`);
  };

  const seenEventsCount = (sniffer?.discoveredEvents || []).filter((e) => e.seenCount > 0).length;
  const armedEventsCount = (sniffer?.discoveredEvents || []).filter((e) => e.binding.enabled).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 sm:p-5 space-y-5">
      {/* Header & Live Telemetry */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <PlugZap className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              קולט אירועי WebSocket חי, מדריך תמונות ושיבוץ סרטוני במה
            </h3>
            <span className="text-xs text-emerald-300 font-medium">
              ·{' '}
              {(sniffer?.activeTikTokSocketsCount || 0) > 0
                ? `${sniffer.activeTikTokSocketsCount} צינורות WebSocket חיים מחוברים`
                : 'ממתין לחיבור חדר חי'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            לכל אירוע שנתפס מהלייב מוצגת תמונה/הדמיה והסבר פשוט בעברית מה קורה על מסך הטיקטוק — לצד תצוגה חיה של הסרטונים שלנו כדי שתוכל לראות ולהתאים ביניהם בקלות.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowVisualCatalog((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              showVisualCatalog
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                : 'bg-[#0B0E14] border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            {showVisualCatalog ? 'הסתר גלריית סרטונים' : 'הצג גלריית סרטונים מצולמת'}
          </button>

          <button
            type="button"
            onClick={() => handleUpdateConfig({ snifferActive: !sniffer?.snifferActive })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              sniffer?.snifferActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-[#0B0E14] border-slate-700 text-slate-400'
            }`}
          >
            {sniffer?.snifferActive ? 'איסוף אירועים: פעיל' : 'איסוף אירועים: מושהה'}
          </button>

          <button
            type="button"
            onClick={() =>
              handleUpdateConfig({ autoExecuteBoundTriggers: !sniffer?.autoExecuteBoundTriggers })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              sniffer?.autoExecuteBoundTriggers
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-[#0B0E14] border-slate-700 text-slate-400'
            }`}
          >
            {sniffer?.autoExecuteBoundTriggers ? 'הפעלות אוטומטיות: חמושות' : 'הפעלות אוטומטיות: כבויות'}
          </button>
        </div>
      </div>

      {/* Visual Guide of Our 10 Studio Videos (including #2 Cryo Vapor/Water-like Jets!) */}
      {showVisualCatalog && (
        <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-400" />
                תצוגה מצולמת של 10 סרטוני האפקטים שלנו (כדי שתראה בדיוק מה כל סרטון עושה לפני השיוך)
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                שים לב במיוחד לסרטון #2 (תותחי קיטור/אדים לבנים שנראים כמו סילוני מים/קרח מתפרצים מהפינות) מול סרטוני האש, הברקים וחיות העוצמה.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {STUDIO_VIDEO_VISUAL_GUIDE.map((item) => {
              const spec = assetById.get(item.id);
              const videoUrl = spec?.videoSrc;
              return (
                <div
                  key={item.id}
                  className="rounded-lg bg-[#121826] border border-slate-800 overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-video w-full bg-black relative overflow-hidden">
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <BeastIllustratedPreview assetId={item.id} />
                      )}
                    </div>
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs font-bold text-slate-100 leading-snug">
                        {item.shortTitleHe}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {item.visualWhatYouSeeHe}
                      </p>
                      <p className="text-[10px] text-amber-300/90 leading-relaxed pt-0.5">
                        מתאים ל: {item.bestEventMatchHe}
                      </p>
                    </div>
                  </div>
                  <div className="px-2.5 pb-2.5">
                    <button
                      type="button"
                      disabled={previewingVfxId === item.id}
                      onClick={() => handlePreviewStudioVideoOnStage(item.id, item.shortTitleHe)}
                      className="w-full py-1.5 px-2.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-100 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {previewingVfxId === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3 text-amber-400" />
                      )}
                      נגן עכשיו בבמה
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-3">
          <span className="text-[11px] text-slate-400 block">חבילות WebSocket שנקלטו</span>
          <span className="text-base font-bold font-mono tabular-nums text-cyan-300">
            {(sniffer?.totalPacketsCaptured || 0).toLocaleString()}
          </span>
        </div>
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-3">
          <span className="text-[11px] text-slate-400 block">סוגי אירועים מזוהים</span>
          <span className="text-base font-bold font-mono tabular-nums text-slate-100">
            {sniffer?.uniqueEventTypesCount || 0}{' '}
            <span className="text-[11px] text-emerald-400 font-normal">· {seenEventsCount} נתפסו חי</span>
          </span>
        </div>
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-3">
          <span className="text-[11px] text-slate-400 block">הפעלות אוטומטיות משובצות</span>
          <span className="text-base font-bold font-mono tabular-nums text-amber-300">
            {armedEventsCount} פעילות
          </span>
        </div>
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-3">
          <span className="text-[11px] text-slate-400 block">טווח הפעלה אוטומטית</span>
          <select
            value={sniffer?.globalScopeOverride || 'ALL_CONNECTED_SOCKETS'}
            onChange={(e) =>
              handleUpdateConfig({
                globalScopeOverride: e.target.value as
                  | 'RESPECT_BINDING'
                  | 'ALL_CONNECTED_SOCKETS'
                  | 'MIRRORED_ONLY',
              })
            }
            className="mt-0.5 w-full bg-transparent text-xs font-semibold text-slate-100 focus:outline-none"
          >
            <option value="ALL_CONNECTED_SOCKETS" className="bg-[#0B0E14]">
              מכל WebSocket מחובר (כולל חדרי בדיקה)
            </option>
            <option value="MIRRORED_ONLY" className="bg-[#0B0E14]">
              רק מהלייב הראשי שלי (Mirrored)
            </option>
            <option value="RESPECT_BINDING" className="bg-[#0B0E14]">
              לפי הגדרה פרטנית בכל אירוע
            </option>
          </select>
        </div>
      </div>

      {/* Connection Bar: TikTok Live WebSocket + External Local/Remote WS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-[#0B0E14] border border-[#1E2636] rounded-xl p-3.5">
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            01. חיבור WebSocket ישיר לטיקטוק לייב (שלי או סריקת לייבים פעילים)
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="@username (חדר טיקטוק חי)..."
              className="flex-1 min-w-[150px] bg-[#121722] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              disabled={connectingRoom}
              onClick={handleConnectTikTokRoom}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors"
            >
              {connectingRoom ? 'מתחבר...' : 'התחבר לחדר'}
            </button>
            <button
              type="button"
              disabled={scanningAutoLive}
              onClick={handleScanAndConnectLiveSockets}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {scanningAutoLive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              סרוק והתחבר ללייבים לאיסוף חי
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <PlugZap className="w-3.5 h-3.5 text-amber-400" />
            02. גשר WebSocket חיצוני (TikFinity / Streamer.bot / שרת מותאם)
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={extUrlInput}
              onChange={(e) => setExtUrlInput(e.target.value)}
              placeholder="ws://localhost:21213/ או wss://..."
              className="flex-1 min-w-[160px] bg-[#121722] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              disabled={connectingExt}
              onClick={() => handleConnectExternalWs()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors"
            >
              חבר WS
            </button>
            <button
              type="button"
              onClick={() => {
                setExtUrlInput('ws://localhost:21213/');
                void handleConnectExternalWs('ws://localhost:21213/');
              }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] bg-[#141B29] border border-slate-700 text-slate-300 hover:border-slate-500"
            >
              TikFinity :21213
            </button>
          </div>

          {(sniffer?.externalBridges || []).length > 0 && (
            <div className="flex items-center gap-3 flex-wrap pt-1 text-[11px] text-slate-300">
              {sniffer.externalBridges.map((b) => (
                <div key={b.url} className="inline-flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      b.connected ? 'bg-emerald-400' : b.connecting ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                  />
                  <span className="font-mono">{b.url}</span>
                  <span className="text-slate-500 font-mono">· {b.messagesReceived} הודעות</span>
                  {b.lastErrorHe && <span className="text-rose-300 text-[10px]">· {b.lastErrorHe}</span>}
                  <button
                    type="button"
                    onClick={() => handleDisconnectExternalWs(b.url)}
                    className="text-slate-400 hover:text-rose-400 p-0.5"
                    title="נתק WebSocket"
                  >
                    <Unplug className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {bannerHe && (
        <div className="px-3.5 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/35 text-xs text-cyan-200 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {bannerHe}
          </span>
          <button
            type="button"
            onClick={() => setBannerHe(null)}
            className="text-[11px] text-slate-400 hover:text-slate-200"
          >
            סגור
          </button>
        </div>
      )}

      {/* Rolling Real-Time Captured WebSocket Stream */}
      {(sniffer?.recentPackets || []).length > 0 && (
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              זרם אירועים חיים שנקלטים עכשיו ב-WebSocket ({sniffer.recentPackets.length} אחרונים)
            </span>
            <button
              type="button"
              onClick={() => handleUpdateConfig({ resetCounters: true })}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              אפס מונים
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/80 pr-1">
            {sniffer.recentPackets.slice(0, compact ? 8 : 14).map((pkt) => (
              <div
                key={pkt.id}
                className="flex items-center justify-between gap-2 text-[11px] py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0 text-slate-300">
                  <span className="font-mono text-slate-500 shrink-0">
                    {new Date(pkt.ts).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-cyan-300 font-semibold shrink-0">{pkt.labelHe}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-amber-300 font-mono shrink-0">{pkt.sourceLabel}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-200 truncate">{pkt.summaryHe}</span>
                </div>
                {pkt.autoTriggered && pkt.triggeredActionsSummaryHe && (
                  <span className="text-emerald-300 text-[10px] font-semibold shrink-0">
                    הופעל: {pkt.triggeredActionsSummaryHe}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & AI Smart Mapper Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0E14] border border-[#1E2636] flex-wrap">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                activeCategory === tab.id
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.labelHe}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש אירוע או תיאור..."
              className="bg-[#0B0E14] border border-[#1E2636] rounded-lg pr-8 pl-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 w-44"
            />
          </div>

          <button
            type="button"
            disabled={aiAssigning}
            onClick={() => handleAiAutoAssign()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50 flex items-center gap-1.5"
          >
            {aiAssigning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            שיבוץ אוטומטי חכם
          </button>

          <button
            type="button"
            onClick={() => setShowNewCustomForm((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0E14] border border-slate-700 text-slate-200 hover:border-slate-500 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            אירוע מותאם
          </button>
        </div>
      </div>

      {showNewCustomForm && (
        <div className="rounded-lg bg-[#0B0E14] border border-cyan-500/40 p-3 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={newEventKey}
            onChange={(e) => setNewEventKey(e.target.value)}
            placeholder="מזהה אירוע (למשל ExternalWS:customAlert או WebcastPollMessage)"
            className="flex-1 min-w-[210px] bg-[#121722] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
          />
          <input
            type="text"
            value={newEventLabelHe}
            onChange={(e) => setNewEventLabelHe(e.target.value)}
            placeholder="שם תצוגה בעברית..."
            className="flex-1 min-w-[160px] bg-[#121722] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
          />
          <button
            type="button"
            onClick={handleCreateCustomEvent}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            הוסף ושבץ
          </button>
        </div>
      )}

      {/* Collected Events with Visual Thumbnails, Plain-Hebrew Explanations & Side-by-Side Video Matcher */}
      <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
        {filteredEvents.map((rec) => {
          const b = rec.binding;
          const isPayloadOpen = expandedPayloadKey === rec.eventKey;
          const selectedVfxAsset = b.vfxId && b.vfxId !== 'NONE' ? assetById.get(b.vfxId) : undefined;
          const hasRealTikTokImg = Boolean(rec.sampleImageUrl && !brokenImgKeys[rec.eventKey]);

          return (
            <div
              key={rec.eventKey}
              className={`rounded-xl border p-4 transition-colors space-y-3 ${
                b.enabled
                  ? 'bg-[#0E1523] border-amber-500/40'
                  : 'bg-[#0B0E14] border-[#1E2636]'
              }`}
            >
              {/* Top Row: Visual Thumbnail + Clear Hebrew Explanation + Controls */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* 72x72 Visual Thumbnail of the Captured Live TikTok Event */}
                  <div className="w-[72px] h-[72px] rounded-lg overflow-hidden border border-slate-700/80 bg-[#090D16] shrink-0 relative flex items-center justify-center">
                    {hasRealTikTokImg && rec.sampleImageUrl ? (
                      <>
                        <img
                          src={rec.sampleImageUrl}
                          alt={rec.labelHe}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImgKeys((prev) => ({ ...prev, [rec.eventKey]: true }))
                          }
                          className="w-full h-full object-contain p-1"
                        />
                        {rec.sampleAvatarUrl && rec.sampleAvatarUrl !== rec.sampleImageUrl && (
                          <img
                            src={rec.sampleAvatarUrl}
                            alt="שולח"
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 rounded-full object-cover border border-amber-400 absolute bottom-1 left-1"
                          />
                        )}
                      </>
                    ) : (
                      <EventSceneDiagram sceneTag={rec.visualSceneTag} />
                    )}
                  </div>

                  {/* Plain-Hebrew Explanation + Clean Unboxed Metadata */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handlePatchBinding(rec.eventKey, { enabled: !b.enabled })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors shrink-0 ${
                          b.enabled
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-[#161D2B] text-slate-400 border border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {b.enabled ? 'מופעל אוטומטית' : 'כבוי'}
                      </button>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                        {rec.labelHe}
                      </h4>
                    </div>

                    {/* Clean Unboxed Metadata Line (Zero Pill Discipline) */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                      <span className="font-mono text-cyan-300/90">{rec.eventKey}</span>
                      <span aria-hidden="true">·</span>
                      <span className={rec.seenCount > 0 ? 'text-emerald-300 font-medium' : 'text-slate-500'}>
                        נקלט {rec.seenCount.toLocaleString()} פעמים
                      </span>
                      {rec.seenCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>מקור אחרון: {rec.lastSourceLabel}</span>
                        </>
                      )}
                      {b.triggeredCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-300">הפעיל במה x{b.triggeredCount}</span>
                        </>
                      )}
                      {savingKey === rec.eventKey && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-400">שומר...</span>
                        </>
                      )}
                    </div>

                    {/* Plain-Hebrew "What you see on TikTok LIVE" */}
                    <p className="text-xs text-slate-200 leading-relaxed pt-0.5">
                      <span className="font-semibold text-cyan-300">מה רואים בלייב: </span>
                      {rec.whatHappensInLiveHe || rec.descriptionHe}
                    </p>

                    {/* Plain-Hebrew Recommendation + Live Sample */}
                    {rec.triggerAdviceHe && (
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        <span className="font-semibold">המלצה לשיוך: </span>
                        {rec.triggerAdviceHe}
                      </p>
                    )}

                    {rec.seenCount > 0 && rec.lastSampleSummaryHe && (
                      <p className="text-[11px] text-slate-400 truncate">
                        דגימה חיה אחרונה: {rec.lastSampleSummaryHe}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={testingKey === rec.eventKey}
                    onClick={() => handleTestBinding(rec)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1"
                  >
                    {testingKey === rec.eventKey ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    בדוק בבמה
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAiAutoAssign(rec.eventKey)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/25"
                    title="בקש המלצת שיוך אוטומטית לאירוע זה"
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpandedPayloadKey(isPayloadOpen ? null : rec.eventKey)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] bg-[#151C2A] border border-slate-700 text-slate-300 hover:text-slate-100 flex items-center gap-1"
                    title="הצג מידע גולמי שנתפס ב-WebSocket"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    {isPayloadOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Trigger Assignment Selectors + Side-by-Side Live Video Preview of Selected VFX */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-1 items-end">
                <div className="lg:col-span-4 flex items-center gap-2">
                  {/* Mini Live Video Thumbnail of Assigned Studio VFX */}
                  {selectedVfxAsset && (
                    <div className="w-16 h-11 rounded-md overflow-hidden border border-amber-500/40 bg-black shrink-0">
                      {selectedVfxAsset.videoSrc ? (
                        <video
                          src={selectedVfxAsset.videoSrc}
                          muted
                          loop
                          autoPlay
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : b.vfxId.startsWith('BEAST_') ? (
                        <BeastIllustratedPreview assetId={b.vfxId} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-amber-300 text-center px-1 leading-tight">
                          אפקט חי
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      סרטון / אפקט במה משויך (VFX)
                    </label>
                    <select
                      value={b.vfxId}
                      onChange={(e) =>
                        handlePatchBinding(rec.eventKey, { vfxId: e.target.value, enabled: e.target.value !== 'NONE' })
                      }
                      className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="NONE">ללא אפקט ויזואלי</option>
                      {BOOSTERA_ASSETS.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.titleHe}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-0.5">תנועת מצלמה</label>
                  <select
                    value={b.cameraPreset}
                    onChange={(e) =>
                      handlePatchBinding(rec.eventKey, {
                        cameraPreset: e.target.value as CameraPresetId | 'NONE',
                        enabled: true,
                      })
                    }
                    className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {CAMERA_OPTIONS.map((cam) => (
                      <option key={cam.value} value={cam.value}>
                        {cam.labelHe}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-0.5">סאונד לשידור</label>
                  <select
                    value={b.soundCueId}
                    onChange={(e) =>
                      handlePatchBinding(rec.eventKey, { soundCueId: e.target.value, enabled: true })
                    }
                    className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="NONE">ללא סאונד</option>
                    {STANDALONE_SOUND_CUES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titleHe}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-0.5">פעולה מיוחדת בבמה</label>
                  <select
                    value={b.specialAction}
                    onChange={(e) =>
                      handlePatchBinding(rec.eventKey, {
                        specialAction: e.target.value as WsSpecialStageAction,
                        enabled: true,
                      })
                    }
                    className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {SPECIAL_ACTION_OPTIONS.map((sp) => (
                      <option key={sp.value} value={sp.value}>
                        {sp.labelHe}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2 grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">מוזיקה</label>
                    <select
                      value={b.musicTrackId}
                      onChange={(e) =>
                        handlePatchBinding(rec.eventKey, { musicTrackId: e.target.value, enabled: true })
                      }
                      className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-1.5 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="KEEP">ללא שינוי</option>
                      {BOOSTERA_MUSIC_TRACKS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.titleHe}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">צינון (שנ׳)</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={b.cooldownSec}
                      onChange={(e) =>
                        handlePatchBinding(rec.eventKey, {
                          cooldownSec: Math.max(1, Number(e.target.value || 5)),
                        })
                      }
                      className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Payload & Fine Tuning */}
              {isPayloadOpen && (
                <div className="rounded-lg bg-[#090C12] border border-slate-800 p-3 space-y-2 text-[11px]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">כיתוב באנר על הבמה</label>
                      <input
                        type="text"
                        defaultValue={b.calloutTextHe}
                        onBlur={(e) => handlePatchBinding(rec.eventKey, { calloutTextHe: e.target.value })}
                        placeholder="למשל: GLOVE x5 NOW!"
                        className="w-full bg-[#141B29] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">סף מינימום (יהלומים/לייקים)</label>
                      <input
                        type="number"
                        min={0}
                        defaultValue={b.minNumericValue}
                        onBlur={(e) =>
                          handlePatchBinding(rec.eventKey, {
                            minNumericValue: Math.max(0, Number(e.target.value || 0)),
                          })
                        }
                        className="w-full bg-[#141B29] border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">שדות שזוהו באירוע</label>
                      <div className="text-[10px] font-mono text-cyan-300 truncate pt-1">
                        {rec.detectedFields.length > 0 ? rec.detectedFields.join(', ') : 'טרם נקלט פריים חי'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">דגימת Payload גולמית אחרונה:</span>
                    <pre className="text-[10px] font-mono text-slate-300 bg-[#101521] p-2 rounded overflow-x-auto">
                      {rec.lastPayloadPreview}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
