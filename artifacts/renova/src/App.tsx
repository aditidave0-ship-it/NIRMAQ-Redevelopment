import { RenovaHome } from "./experience/Home";
import { BRAND_NAME, CONTACT_EMAIL } from "./brand";
import { ExperienceFooter, ExperienceHeader } from "./experience/Header";
import { ContactPage } from "./experience/ContactForm";
import { TentativeFeasibility } from "./experience/TentativeFeasibility";
import { DcprGuidePage } from "./experience/DcprGuide";
import { FeasibilityCheckPage } from "./experience/FeasibilityCheck";
import { IntakeFormPage } from "./experience/IntakeForm";
import { FeasibilityDocumentsPage } from "./experience/FeasibilityDocuments";
import { FeasibilityDashboardPage } from "./experience/FeasibilityDashboard";
import { GetStartedPage } from "./experience/GetStarted";
import { getCanonicalUrl, getPageMeta } from "./experience/page-meta";
import { PrivacyPage } from "./experience/PrivacyPages";
import { sendRequirementEnquiry } from "./experience/requirement-enquiry";
import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpenText,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  HardHat,
  Handshake,
  Home,
  Landmark,
  ListFilter,
  LoaderCircle,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Link, Route, useLocation, useParams } from "wouter";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  getOrganization,
  organizationCategories,
  organizationDataVersion,
  organizations,
  type Organization,
} from "@/data/organizations";
import "./index.css";
import "./marketing.css";
import "./requirement.css";

const queryClient = new QueryClient();
const LiveWorkspace = lazy(() =>
  import("@/platform/LiveWorkspace").then((module) => ({
    default: module.LiveWorkspace,
  })),
);
// Stage 0 design spike (additive route only; not linked from the live site).
const Stage0Spike = lazy(() => import("./spike/Stage0Spike"));

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function readStoredArray<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function Logo({ variant = "navy" }: { variant?: "navy" | "ivory" }) {
  return (
    <Link
      href="/"
      className="brand-lockup"
      data-testid="link-home"
      aria-label={`${BRAND_NAME} home`}
    >
      <img
        className="brand-mark-img"
        src={
          variant === "ivory"
            ? "/brand/nirmaq-mark-ivory.png"
            : "/brand/nirmaq-mark-navy.png"
        }
        alt=""
        aria-hidden="true"
      />
      <span className="brand-name">{BRAND_NAME}</span>
    </Link>
  );
}

function LoadingPage({
  label = "Preparing your workspace",
}: {
  label?: string;
}) {
  return (
    <div className="state-page" data-testid="state-loading">
      <div className="skeleton-mark">
        <LoaderCircle size={22} />
      </div>
      <div className="skeleton-line skeleton-wide" />
      <div className="skeleton-line skeleton-mid" />
      <p>{label}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: typeof Building2;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" data-testid="state-empty">
      <div className="state-icon">
        <Icon size={23} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "orange" | "green" | "red";
}) {
  return (
    <span
      className={`status-pill status-${tone}`}
      data-testid={`status-${String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      {children}
    </span>
  );
}

function ExperienceDrawer({
  open,
  onClose,
  eyebrow,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="experience-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="experience-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="experience-drawer-title"
      >
        <div className="experience-drawer-head">
          <div>
            <p>{eyebrow}</p>
            <h2 id="experience-drawer-title">{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
          >
            <X size={20} />
          </button>
        </div>
        <div className="experience-drawer-body">{children}</div>
      </section>
    </div>
  );
}

function PageIntro({
  kicker,
  title,
  detail,
  action,
}: {
  kicker: string;
  title: ReactNode;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="page-description">{detail}</p>
      </div>
      {action}
    </div>
  );
}

// Prompt H, Task 4: the regulation centre's data is static orientation
// content. It used to come from the unauthenticated legacy demo API
// (GET /api/regulations, deleted with that router); it now lives in the
// frontend. The page already says these are general orientation notes whose
// currency and applicability NIRMAQ has not verified.
const REGULATIONS = [
  { id: "reg-33-5", code: "33(5)", title: "Redevelopment of MHADA colonies", summary: "Provisions relevant to redevelopment of buildings and layouts under MHADA jurisdiction.", authority: "MHADA / BMC", updatedAt: "16 Aug 2026", status: "Current" },
  { id: "reg-33-7", code: "33(7)", title: "Redevelopment of cessed buildings", summary: "A potential pathway for redevelopment of eligible cessed buildings in Mumbai.", authority: "BMC DCPR 2034", updatedAt: "16 Aug 2026", status: "Current" },
  { id: "reg-33-9", code: "33(9)", title: "Cluster redevelopment", summary: "Framework for redevelopment of multiple buildings or societies as a cluster.", authority: "BMC DCPR 2034", updatedAt: "16 Aug 2026", status: "Current" },
  { id: "reg-33-10", code: "33(10)", title: "Slum rehabilitation schemes", summary: "Potentially relevant provisions for SRA schemes and rehabilitation projects.", authority: "SRA / BMC", updatedAt: "16 Aug 2026", status: "Current" },
];

function Regulations() {
  const regulations = REGULATIONS;
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("All");
  const [activeRegulationId, setActiveRegulationId] = useState<string | null>(
    null,
  );
  const [showOrientation, setShowOrientation] = useState(false);
  const statuses = [
    "All",
    ...Array.from(new Set(regulations.map((item) => item.status))),
  ];
  const filtered = regulations.filter(
    (item) =>
      (activeStatus === "All" || item.status === activeStatus) &&
      `${item.code} ${item.title} ${item.summary} ${item.authority}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const activeRegulation = regulations.find(
    (item) => item.id === activeRegulationId,
  );
  const downloadGuide = () => {
    const guide = [
      "NIRMAQ — SOCIETY REDEVELOPMENT COMMITTEE STARTER GUIDE",
      "",
      "1. Record the society’s redevelopment intent and committee authority.",
      "2. Collect title, conveyance, property-card and structural-audit records.",
      "3. Commission an independent feasibility study before inviting proposals.",
      "4. Define transparent evaluation criteria for PMC, architect and developer selection.",
      "5. Record every resolution, disclosure and member communication.",
      "",
      "Important: This guide is an orientation tool, not legal or technical advice. Verify the applicable pathway with qualified professionals and the relevant authority.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([guide], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "NIRMAQ-committee-starter-guide.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="content-stack">
      <PageIntro
        kicker="Know the rules before you negotiate"
        title={
          <>
            The regulation
            <br />
            <em>centre.</em>
          </>
        }
        detail="Plain-language guidance for the permissions, notices, and approvals that shape your redevelopment."
        action={
          <button
            className="button button-outline"
            onClick={downloadGuide}
            data-testid="button-regulation-guide"
          >
            <FileText size={16} /> Download committee guide
          </button>
        }
      />
      <p role="note">
        General orientation notes. NIRMAQ has not verified their regulatory
        currency or applicability. Confirm requirements with the relevant
        authority and your professional advisors.
      </p>
      <div className="regulation-feature">
        <div>
          <span className="feature-label">
            <BookOpenText size={15} /> Start here
          </span>
          <h2>
            What changes when
            <br />
            your society redevelops?
          </h2>
          <p>
            A practical orientation to the decisions your committee will make,
            from consent to conveyance.
          </p>
          <button
            className="text-link light-link"
            onClick={() => setShowOrientation(true)}
            data-testid="button-read-orientation"
          >
            Read the orientation <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="feature-lines">
          <span>01&nbsp; Consent</span>
          <span>02&nbsp; Feasibility</span>
          <span>03&nbsp; Appointment</span>
          <span>04&nbsp; Approvals</span>
        </div>
      </div>
      <div className="directory-toolbar regulation-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search codes, topics, or authorities"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="input-search-regulations"
          />
        </div>
        <div className="filter-group">
          <ListFilter size={15} />
          <span>Show</span>
          {statuses.map((status) => (
            <button
              key={status}
              className={cn(
                "filter-chip",
                activeStatus === status && "selected",
              )}
              onClick={() => setActiveStatus(status)}
              data-testid={`button-regulation-filter-${status.toLowerCase().replaceAll(" ", "-")}`}
            >
              {status === "All" ? "All" : "Orientation notes"}
            </button>
          ))}
        </div>
      </div>
      <div className="directory-result-bar">
        <span>{filtered.length} guidance notes</span>
        {(search || activeStatus !== "All") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveStatus("All");
            }}
          >
            Reset view <RotateCcw size={13} />
          </button>
        )}
      </div>
      <div className="regulation-list">
        {filtered.length ? (
          filtered.map((item) => (
            <article
              className="regulation-row"
              key={item.id}
              data-testid={`row-regulation-${item.id}`}
            >
              <div className="regulation-code">{item.code}</div>
              <div className="regulation-copy">
                <div className="regulation-title-row">
                  <h3>{item.title}</h3>
                  <StatusPill tone="neutral">Orientation</StatusPill>
                </div>
                <p>{item.summary}</p>
                <div className="regulation-meta">
                  <span>
                    <Landmark size={13} /> {item.authority}
                  </span>
                </div>
              </div>
              <button
                className="icon-button regulation-open"
                onClick={() => setActiveRegulationId(item.id)}
                aria-label={`Open ${item.code}`}
                data-testid={`button-open-regulation-${item.id}`}
              >
                <ArrowUpRight size={17} />
              </button>
            </article>
          ))
        ) : (
          <EmptyState
            icon={BookOpenText}
            title="No guidance found"
            detail="Try searching for a code, authority, or topic."
          />
        )}
      </div>
      <ExperienceDrawer
        open={showOrientation}
        onClose={() => setShowOrientation(false)}
        eyebrow="Redevelopment orientation"
        title="Four decisions shape a safer start"
      >
        <div className="orientation-steps">
          {[
            [
              "01",
              "Build informed consent",
              "Give members the same facts, record questions and define how decisions will be taken.",
            ],
            [
              "02",
              "Establish feasibility",
              "Understand title, land, planning potential, liabilities and realistic project economics.",
            ],
            [
              "03",
              "Appoint independently",
              "Use documented criteria and conflict disclosures when selecting advisors and development partners.",
            ],
            [
              "04",
              "Protect execution",
              "Track approvals, bank guarantees, milestones, member obligations and handover evidence.",
            ],
          ].map(([number, title, detail]) => (
            <article key={number}>
              <span>{number}</span>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="drawer-note">
          <AlertTriangle size={18} />
          <p>
            Applicable rules depend on land tenure, building category and
            authority. Confirm your route with qualified legal and technical
            advisors.
          </p>
        </div>
      </ExperienceDrawer>
      <ExperienceDrawer
        open={Boolean(activeRegulation)}
        onClose={() => setActiveRegulationId(null)}
        eyebrow={`Guidance note · ${activeRegulation?.code || ""}`}
        title={activeRegulation?.title || "Regulation guidance"}
      >
        {activeRegulation && (
          <div className="regulation-detail">
            <div className="regulation-detail-status">
              <StatusPill tone="neutral">Orientation</StatusPill>
              <span>Regulatory currency not verified</span>
            </div>
            <p className="regulation-detail-lead">{activeRegulation.summary}</p>
            <div className="profile-facts">
              <div>
                <span>Authority</span>
                <strong>{activeRegulation.authority}</strong>
              </div>
              <div>
                <span>NIRMAQ status</span>
                <strong>Orientation available</strong>
              </div>
            </div>
            <div>
              <p className="drawer-label">Committee questions to confirm</p>
              <ul>
                <li>Does the society and its land fall within this pathway?</li>
                <li>
                  Which documents establish eligibility and development
                  potential?
                </li>
                <li>Which authority approvals and member resolutions apply?</li>
                <li>
                  What should be independently verified before proposals are
                  compared?
                </li>
              </ul>
            </div>
            <div className="drawer-note">
              <ShieldCheck size={18} />
              <p>
                NIRMAQ presents plain-language orientation. The governing
                notification, circular or regulation and professional advice
                remain authoritative.
              </p>
            </div>
            <Link
              href="/professionals/legal"
              className="button button-dark button-full"
            >
              Find a legal advisor <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
      </ExperienceDrawer>
    </div>
  );
}

const stakeholderCards = [
  {
    title: "Find a Developer",
    detail: "Explore public developer profiles and their documented services.",
    icon: Building2,
    href: "/ecosystem?category=Developers",
  },
  {
    title: "Explore Societies",
    detail:
      "See how structured redevelopment opportunities can appear on NIRMAQ.",
    icon: Landmark,
    href: "#opportunities",
  },
  {
    title: "Find a PMC",
    detail: "Bring structure, evaluation and oversight to your redevelopment.",
    icon: ClipboardCheck,
    href: "/ecosystem?category=PMC",
  },
  {
    title: "Find an Architect",
    detail: "Explore architecture practices across the ecosystem.",
    icon: Compass,
    href: "/ecosystem?category=Architects",
  },
];

const featuredOpportunities = [
  {
    status: "Ready to explore",
    name: "Ashirwad CHS",
    location: "Andheri West",
    detail:
      "A resident-led opportunity seeking a transparent redevelopment partner.",
    age: "42 yrs",
    homes: "96",
    area: "1.8 acres",
    scale: "₹80–120 Cr",
  },
  {
    status: "Shortlisting",
    name: "Shantivan Cooperative",
    location: "Chembur",
    detail:
      "Large-format society with a clear committee mandate and strong connectivity.",
    age: "38 yrs",
    homes: "144",
    area: "2.4 acres",
    scale: "₹120–180 Cr",
  },
  {
    status: "New opportunity",
    name: "Sea Breeze Apartments",
    location: "Bandra East",
    detail:
      "An established community looking for a capable PMC to begin feasibility.",
    age: "51 yrs",
    homes: "58",
    area: "0.9 acres",
    scale: "₹45–70 Cr",
  },
  {
    status: "Open for proposals",
    name: "Navjeevan Nagar",
    location: "Vikhroli",
    detail:
      "A high-potential opportunity near major transit and employment corridors.",
    age: "34 yrs",
    homes: "212",
    area: "3.1 acres",
    scale: "₹180–260 Cr",
  },
];

const trustBenefits = [
  {
    title: "Clear Profile Status",
    detail:
      "Public profiles and NIRMAQ-verified organizations are labelled distinctly, so provenance stays visible.",
    icon: ShieldCheck,
  },
  {
    title: "Accelerated Timelines",
    detail:
      "Structured requirements and milestone tracking reduce avoidable delays.",
    icon: Zap,
  },
  {
    title: "Absolute Transparency",
    detail:
      "Clear context, project details and expectations support better decisions.",
    icon: Eye,
  },
];

function CinematicVideoIntro({ onFinish }: { onFinish: () => void }) {
  const exitTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const finishIntro = () => {
    if (isExiting) return;
    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(onFinish, 820);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const isSmallScreen = window.matchMedia("(max-width: 760px)").matches;
    fallbackTimerRef.current = window.setTimeout(
      () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.paused) {
          setShowFallback(true);
          window.setTimeout(finishIntro, isSmallScreen ? 300 : 700);
        }
      },
      isSmallScreen ? 950 : 1800,
    );
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {
        setShowFallback(true);
        window.setTimeout(finishIntro, 350);
      });
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      if (fallbackTimerRef.current)
        window.clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  return (
    <section
      className={`renova-film-intro${isExiting ? " is-exiting" : ""}`}
      role="dialog"
      aria-label="NIRMAQ introduction film"
      aria-modal="true"
    >
      <video
        ref={videoRef}
        className="renova-film-video"
        autoPlay
        muted
        playsInline
        preload="auto"
        onPlay={() => setShowFallback(false)}
        onEnded={finishIntro}
        onError={() => setShowFallback(true)}
      >
        <source
          src={`${import.meta.env.BASE_URL}renova-intro.mp4`}
          type="video/mp4"
        />
      </video>
      {showFallback && (
        <div className="renova-film-fallback" role="status">
          <span>NIRMAQ</span>
          <strong>The same property. A new possibility.</strong>
          <p>The intro film is taking longer to load on this connection.</p>
          <button
            type="button"
            className="renova-film-enter"
            onClick={finishIntro}
          >
            Enter NIRMAQ <ArrowUpRight size={14} />
          </button>
        </div>
      )}
      <button type="button" className="renova-film-skip" onClick={finishIntro}>
        Skip Intro <ArrowUpRight size={14} />
      </button>
    </section>
  );
}

function MarketingHome() {
  // Intro video splash disabled (owner decision, 22 Nov 2026): the home
  // screen now opens directly on the hero background. The intro video
  // file is retained untouched for future home-screen use.
  const [showIntro, setShowIntro] = useState(false);
  return (
    <>
      <div className="renova-home-underlay" inert={showIntro}>
        <RenovaHome />
      </div>
      {showIntro && (
        <CinematicVideoIntro onFinish={() => setShowIntro(false)} />
      )}
    </>
  );
}

type PublicPageData = {
  eyebrow: string;
  title: string;
  intro: string;
  highlights: Array<{ title: string; detail: string; href?: string }>;
  ctaLabel: string;
  ctaHref: string;
  showTentativeFeasibility?: boolean;
};

const publicPageMap: Record<string, PublicPageData> = {
  "/projects": {
    eyebrow: "NIRMAQ project directory",
    title: "Redevelopment opportunities, clearly organised.",
    intro:
      "Explore society opportunities and follow projects from early intent through active execution and completion.",
    highlights: [
      {
        title: "Current Opportunities",
        detail:
          "Societies actively seeking the right development or professional partner.",
      },
      {
        title: "Ongoing Projects",
        detail:
          "Redevelopment journeys that have moved into planning, approvals or execution.",
      },
      {
        title: "Upcoming Projects",
        detail:
          "Early-stage societies preparing documents, feasibility and committee alignment.",
      },
      {
        title: "Completed Projects",
        detail:
          "Finished redevelopment stories with practical outcomes and learning.",
      },
    ],
    ctaLabel: "View current opportunities",
    ctaHref: "/projects/current",
  },
  "/projects/current": {
    eyebrow: "Current opportunities",
    title: "Verified opportunities ready for the next conversation.",
    intro:
      "Review active society requirements with clear location, scale, project stage and professional needs.",
    highlights: featuredOpportunities.map((item) => ({
      title: item.name + " · " + item.location,
      detail: item.detail + " Indicative scale: " + item.scale + ".",
    })),
    ctaLabel: "Post a society requirement",
    ctaHref: "/assessment",
  },
  "/projects/ongoing": {
    eyebrow: "Ongoing projects",
    title: "Track redevelopment beyond the first introduction.",
    intro:
      "NIRMAQ brings milestones, project context and stakeholder visibility into one structured view.",
    highlights: [
      {
        title: "Planning & feasibility",
        detail: "Track technical studies, member inputs and project viability.",
      },
      {
        title: "Selection & appointment",
        detail:
          "Keep evaluation criteria, proposals and decisions transparent.",
      },
      {
        title: "Approvals & execution",
        detail:
          "Follow permissions, vacating, construction and handover milestones.",
      },
    ],
    ctaLabel: "Open society workspace",
    ctaHref: "/workspace",
  },
  "/projects/upcoming": {
    eyebrow: "Upcoming projects",
    title: "Discover societies preparing for redevelopment.",
    intro:
      "Early visibility helps developers and professionals understand where future opportunities are forming.",
    highlights: [
      {
        title: "Intent recorded",
        detail: "The society has begun internal redevelopment discussions.",
      },
      {
        title: "Documents in preparation",
        detail:
          "Title, conveyance, audit and property information are being organised.",
      },
      {
        title: "Professional guidance required",
        detail:
          "PMCs, architects and legal advisors can support the next step.",
      },
    ],
    ctaLabel: "Join the NIRMAQ network",
    ctaHref: "/join",
  },
  "/projects/completed": {
    eyebrow: "Completed projects",
    title: "Successful redevelopment, documented with clarity.",
    intro:
      "See how communities, developers and professionals worked together to create safer, better homes.",
    highlights: [
      {
        title: "Before and after",
        detail:
          "Understand the property challenge and the completed transformation.",
      },
      {
        title: "Delivery journey",
        detail: "Review key milestones, decisions and project safeguards.",
      },
      {
        title: "Community outcome",
        detail: "See the residential, amenity and long-term value created.",
      },
    ],
    ctaLabel: "Explore success stories",
    ctaHref: "/success-stories",
  },
  "/societies": {
    eyebrow: "For housing societies",
    title: "Make the first redevelopment decision with confidence.",
    intro:
      "NIRMAQ helps committees understand potential, organise requirements and connect with verified developers and specialists.",
    highlights: [
      {
        title: "Clear first step",
        detail:
          "Post your society requirement in a structured, private format.",
      },
      {
        title: "Verified connections",
        detail:
          "Meet developers, PMCs, architects and advisors suited to your stage.",
      },
      {
        title: "Better comparison",
        detail:
          "Bring project information and expectations into one consistent process.",
      },
    ],
    ctaLabel: "Register your society",
    ctaHref: "/assessment",
    showTentativeFeasibility: true,
  },
  "/societies/how-it-works": {
    eyebrow: "Society journey",
    title: "From committee intent to the right redevelopment team.",
    intro:
      "A practical route designed around society readiness, independent understanding and transparent selection.",
    highlights: [
      {
        title: "01 · Register",
        detail: "Share society, property and committee details.",
      },
      {
        title: "02 · Review",
        detail: "NIRMAQ understands your stage, needs and documentation gaps.",
      },
      {
        title: "03 · Connect",
        detail: "Explore appropriate developers and professional specialists.",
      },
      {
        title: "04 · Progress",
        detail:
          "Use a structured workspace to follow decisions and milestones.",
      },
    ],
    ctaLabel: "Start society registration",
    ctaHref: "/assessment",
  },
  "/developers": {
    eyebrow: "For developers",
    title: "Find better-qualified redevelopment opportunities.",
    intro:
      "NIRMAQ helps developers discover genuine society requirements with clearer project context and professional introductions.",
    highlights: [
      {
        title: "Relevant opportunities",
        detail:
          "Filter society requirements by location, scale, stage and need.",
      },
      {
        title: "Structured briefs",
        detail:
          "Understand the opportunity before investing time in a proposal.",
      },
      {
        title: "Credible presence",
        detail:
          "Present capabilities, experience and project fit within a verified network.",
      },
    ],
    ctaLabel: "Register as a developer",
    ctaHref: "/join/developer",
  },
  "/professionals": {
    eyebrow: "NIRMAQ professional network",
    title: "The right expertise for every redevelopment stage.",
    intro:
      "Discover PMCs, architects, legal advisors and specialist professionals who understand Mumbai society redevelopment.",
    highlights: [
      {
        title: "PMCs",
        detail:
          "Feasibility, tendering, developer evaluation, project controls and society representation.",
      },
      {
        title: "Architects",
        detail:
          "Planning potential, DCPR strategy, design, approvals and redevelopment coordination.",
      },
      {
        title: "Legal",
        detail:
          "Title, conveyance, agreements, member protection and redevelopment documentation.",
      },
      {
        title: "Other Professionals",
        detail:
          "Structural, financial, valuation, liaison and specialist project support.",
      },
    ],
    ctaLabel: "Join as a professional",
    ctaHref: "/join",
  },
  "/professionals/pmcs": {
    eyebrow: "Professional network · PMCs",
    title: "Bring structure and independent oversight to redevelopment.",
    intro:
      "Connect with project management consultants experienced in feasibility, tendering, evaluation, execution monitoring and society communication.",
    highlights: [
      {
        title: "Feasibility & readiness",
        detail:
          "Assess property information, planning potential, documentation and member priorities.",
      },
      {
        title: "Tender & selection",
        detail:
          "Prepare scope, invite proposals and compare developers through consistent criteria.",
      },
      {
        title: "Project oversight",
        detail:
          "Track approvals, milestones, quality, reporting and handover obligations.",
      },
    ],
    ctaLabel: "Register as a PMC",
    ctaHref: "/join/pmc",
  },
  "/professionals/architects": {
    eyebrow: "Professional network · Architects",
    title: "Translate redevelopment potential into better communities.",
    intro:
      "Find architects who combine planning knowledge, design quality and practical coordination for Mumbai redevelopment projects.",
    highlights: [
      {
        title: "Potential studies",
        detail:
          "Interpret site context, development controls and realistic built-form opportunity.",
      },
      {
        title: "Planning & design",
        detail:
          "Balance member needs, sale potential, amenities, circulation and buildability.",
      },
      {
        title: "Approvals coordination",
        detail:
          "Support the technical documentation and authority process needed to progress.",
      },
    ],
    ctaLabel: "Register as an architect",
    ctaHref: "/join/architect",
  },
  "/professionals/legal": {
    eyebrow: "Professional network · Legal",
    title: "Protect the society before, during and after appointment.",
    intro:
      "Connect with legal professionals experienced in society title, conveyance, tender safeguards, development agreements and member rights.",
    highlights: [
      {
        title: "Title & authority",
        detail:
          "Review ownership, conveyance, society records and the legal ability to proceed.",
      },
      {
        title: "Appointment safeguards",
        detail:
          "Strengthen tender conditions, selection records, guarantees and development terms.",
      },
      {
        title: "Member protection",
        detail:
          "Clarify rent, corpus, area, timelines, defaults, insurance and handover obligations.",
      },
    ],
    ctaLabel: "Contact NIRMAQ",
    ctaHref: "/contact",
  },
  "/professionals/others": {
    eyebrow: "Professional network · Specialists",
    title: "Complete the redevelopment team with specialist expertise.",
    intro:
      "Find the technical, financial and coordination support needed for clearer decisions and stronger project delivery.",
    highlights: [
      {
        title: "Structural & technical",
        detail:
          "Audits, surveys, engineering review, quality control and specialist certification.",
      },
      {
        title: "Financial & valuation",
        detail:
          "Project economics, proposal comparison, taxation, valuation and member guidance.",
      },
      {
        title: "Liaison & coordination",
        detail:
          "Documentation, authority follow-up and specialist support across the project lifecycle.",
      },
    ],
    ctaLabel: "Introduce your practice",
    ctaHref: "/contact",
  },
  "/join": {
    eyebrow: "Join NIRMAQ",
    title: "Choose how you want to participate.",
    intro:
      "Create the right NIRMAQ pathway for your society, development business or professional practice.",
    highlights: [
      {
        title: "Housing Society",
        detail: "Post a requirement and organise your redevelopment journey.",
      },
      {
        title: "Developer",
        detail: "Find suitable opportunities and build a trusted profile.",
      },
      {
        title: "PMC",
        detail: "Support societies with feasibility, process and oversight.",
      },
      {
        title: "Architect",
        detail: "Bring design, planning and redevelopment potential to life.",
      },
    ],
    ctaLabel: "Register a society",
    ctaHref: "/assessment",
  },
  "/join/developer": {
    eyebrow: "Developer registration",
    title: "Build your verified NIRMAQ developer profile.",
    intro:
      "Share your organisation, experience, preferred locations, project scale and redevelopment capabilities.",
    highlights: [
      {
        title: "Company profile",
        detail:
          "Organisation, leadership, registration and contact information.",
      },
      {
        title: "Redevelopment experience",
        detail: "Completed, ongoing and relevant society projects.",
      },
      {
        title: "Opportunity preferences",
        detail: "Locations, plot sizes, member counts and project values.",
      },
    ],
    ctaLabel: "Contact the NIRMAQ team",
    ctaHref: "/contact",
  },
  "/join/pmc": {
    eyebrow: "PMC registration",
    title: "Help societies move forward with structure.",
    intro:
      "Create a professional profile covering feasibility, tendering, project management and delivery oversight.",
    highlights: [
      {
        title: "Practice credentials",
        detail: "Team, registrations, years of experience and service areas.",
      },
      {
        title: "Society experience",
        detail: "Relevant redevelopment mandates and completed assignments.",
      },
      {
        title: "Specialist services",
        detail: "Feasibility, tendering, evaluation, approvals and monitoring.",
      },
    ],
    ctaLabel: "Contact the NIRMAQ team",
    ctaHref: "/contact",
  },
  "/join/architect": {
    eyebrow: "Architect registration",
    title: "Shape what Mumbai communities can become.",
    intro:
      "Present your redevelopment design, planning, approvals and society consultation capabilities.",
    highlights: [
      {
        title: "Practice profile",
        detail: "Team, registrations, portfolio and design approach.",
      },
      {
        title: "Planning expertise",
        detail: "DCPR pathways, potential studies and authority coordination.",
      },
      {
        title: "Relevant portfolio",
        detail: "Residential, mixed-use and society redevelopment work.",
      },
    ],
    ctaLabel: "Contact the NIRMAQ team",
    ctaHref: "/contact",
  },
  "/knowledge-centre": {
    eyebrow: "Knowledge centre",
    title: "Redevelopment knowledge, without the confusion.",
    intro:
      "Plain-language guidance for committees, developers and professionals navigating Mumbai redevelopment.",
    highlights: [
      {
        title: "Redevelopment Guide",
        detail: "A stage-by-stage orientation from first intent to possession.",
        href: "/knowledge-centre/redevelopment-guide",
      },
      {
        title: "DCPR 2034 Guide",
        href: "/knowledge-centre/dcpr-2034",
        detail:
          "The regulations that decide what your building can become — 33(7), 33(7)(A), 33(7)(B), 33(9) and more, in plain language.",
      },
      {
        title: "Society Process",
        href: "/knowledge-centre/society-process",
        detail:
          "Learn the resolutions, documents and committee actions involved.",
      },
      {
        title: "Developer Selection",
        href: "/knowledge-centre/developer-selection",
        detail:
          "Compare capability, commercial terms and execution safeguards.",
      },
      {
        title: "FAQs",
        detail: "Practical answers to common redevelopment questions.",
        href: "/knowledge-centre/faqs",
      },
    ],
    ctaLabel: "Read the DCPR 2034 guide",
    ctaHref: "/knowledge-centre/dcpr-2034",
  },
  "/knowledge-centre/redevelopment-guide": {
    eyebrow: "Redevelopment guide",
    title: "A clearer route from intent to possession.",
    intro:
      "Use this guide to understand the major decisions, documents and safeguards across the redevelopment lifecycle.",
    highlights: [
      {
        title: "Prepare",
        detail:
          "Align members, confirm authority and collect property records.",
      },
      {
        title: "Assess",
        detail:
          "Commission feasibility and understand the applicable planning pathway.",
      },
      {
        title: "Select",
        detail:
          "Appoint advisors and evaluate developers through recorded criteria.",
      },
      {
        title: "Execute",
        detail:
          "Protect milestones, payments, quality and handover obligations.",
      },
    ],
    ctaLabel: "Post your requirement",
    ctaHref: "/assessment",
  },
  "/knowledge-centre/society-process": {
    eyebrow: "Society process",
    title: "Every committee step, organised.",
    intro:
      "Understand the sequence of member communication, resolutions, professional appointments and project decisions.",
    highlights: [
      {
        title: "Committee readiness",
        detail: "Define roles, communication and record-keeping.",
      },
      {
        title: "Member consent",
        detail:
          "Share consistent information and record decisions transparently.",
      },
      {
        title: "Professional appointments",
        detail: "Use documented scope, criteria and conflict disclosures.",
      },
      {
        title: "Project safeguards",
        detail: "Review agreements, guarantees, timelines and reporting.",
      },
    ],
    ctaLabel: "Register your society",
    ctaHref: "/assessment",
  },
  "/knowledge-centre/developer-selection": {
    eyebrow: "Developer selection",
    title: "Compare more than the headline offer.",
    intro:
      "A strong selection process tests capability, financial strength, design quality, terms and execution safeguards.",
    highlights: [
      {
        title: "Track record",
        detail:
          "Review comparable redevelopment work and delivery performance.",
      },
      {
        title: "Commercial clarity",
        detail:
          "Compare area, corpus, rent, timelines and obligations consistently.",
      },
      {
        title: "Execution strength",
        detail:
          "Assess approvals capability, funding and construction systems.",
      },
      {
        title: "Member protection",
        detail:
          "Verify guarantees, insurance, default provisions and reporting.",
      },
    ],
    ctaLabel: "Find verified developers",
    ctaHref: "/developers",
  },
  "/knowledge-centre/faqs": {
    eyebrow: "Frequently asked questions",
    title: "Straight answers for redevelopment decisions.",
    intro:
      "Start with the questions societies most often ask before beginning a formal redevelopment process.",
    highlights: [
      {
        title: "When should a society consider redevelopment?",
        detail:
          "When structural, functional or long-term value needs justify a feasibility review.",
      },
      {
        title: "Who should advise the society?",
        detail:
          "Independent technical, legal and financial professionals appropriate to the property.",
      },
      {
        title: "How should developers be compared?",
        detail:
          "Through documented criteria covering capability, proposal terms, safeguards and delivery.",
      },
      {
        title: "Does NIRMAQ replace professional advice?",
        detail:
          "No. NIRMAQ organises information and connections; qualified advice remains essential.",
      },
    ],
    ctaLabel: "Ask NIRMAQ",
    ctaHref: "/contact",
  },
  "/success-stories": {
    eyebrow: "Success stories",
    title: "Better redevelopment starts with better alignment.",
    intro:
      "NIRMAQ success stories will document the challenge, the people, the process and the community outcome.",
    highlights: [
      {
        title: "Society perspective",
        detail: "What mattered to members and how decisions became clearer.",
      },
      {
        title: "Developer perspective",
        detail: "How project fit, planning and execution were established.",
      },
      {
        title: "Professional perspective",
        detail: "How specialists protected quality and process.",
      },
    ],
    ctaLabel: "Explore completed projects",
    ctaHref: "/projects/completed",
  },
  "/about": {
    eyebrow: "About NIRMAQ",
    title: "Redevelopment, reimagined for Mumbai.",
    intro:
      "NIRMAQ is a focused platform connecting housing societies, developers, PMCs, architects, legal advisors and specialists.",
    highlights: [
      {
        title: "Aziz Parihar — Founder",
        detail:
          "Founder of NIRMAQ · 12+ years in real estate, construction and redevelopment across BMC, SRA and MHADA schemes.",
      },
      {
        title: "Our purpose",
        detail:
          "Make redevelopment easier to understand, compare and progress.",
      },
      {
        title: "Our role",
        detail:
          "Create structured requirements, source-backed discovery and clearer connections.",
      },
      {
        title: "Our principle",
        detail:
          "Support informed decisions without replacing independent professional advice.",
      },
    ],
    ctaLabel: "See how NIRMAQ works",
    ctaHref: "/societies/how-it-works",
  },
  "/contact": {
    eyebrow: "Contact NIRMAQ",
    title: "Tell us where you are in the journey.",
    intro:
      "Whether you represent a society, developer or professional practice, NIRMAQ can help identify the right next step.",
    highlights: [
      {
        title: "Housing societies",
        detail: "Share your property context and current redevelopment stage.",
      },
      {
        title: "Developers",
        detail:
          "Tell us your opportunity preferences and redevelopment experience.",
      },
      {
        title: "Professionals",
        detail:
          "Introduce your practice, specialisation and Mumbai project portfolio.",
      },
    ],
    ctaLabel: "Post a society requirement",
    ctaHref: "/assessment",
  },
};

function PublicWorkingHeader() {
  return <ExperienceHeader />;
}

const projectTabs = [
  { label: "All Projects", href: "/projects", stage: "all" },
  {
    label: "Current Opportunities",
    href: "/projects/current",
    stage: "current",
  },
  { label: "Ongoing Projects", href: "/projects/ongoing", stage: "ongoing" },
  { label: "Upcoming Projects", href: "/projects/upcoming", stage: "upcoming" },
  {
    label: "Completed Projects",
    href: "/projects/completed",
    stage: "completed",
  },
];

function ProjectsDirectory() {
  const [location] = useLocation();
  const pathname = location.split("?")[0];
  const activeStage =
    projectTabs.find((tab) => tab.href === pathname)?.stage || "all";
  const [search, setSearch] = useState("");
  const isActiveListing = activeStage === "all" || activeStage === "current";
  const visibleProjects = isActiveListing
    ? featuredOpportunities.filter((item) =>
        (item.name + " " + item.location + " " + item.status)
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : [];

  return (
    <div className="marketing-site public-content-page renova-public-experience working-page">
      <PublicWorkingHeader />
      <main id="main-content">
        <section className="working-hero">
          <div>
            <p>NIRMAQ project directory</p>
            <h1>Explore redevelopment opportunities.</h1>
            <span>
              Search verified society opportunities and follow projects through
              every stage of redevelopment.
            </span>
          </div>
          <Link href="/assessment" className="stitch-primary-button">
            Post an opportunity <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="project-directory-shell">
          <div
            className="project-directory-tabs"
            role="navigation"
            aria-label="Project categories"
          >
            {projectTabs.map((tab) => (
              <Link
                href={tab.href}
                key={tab.href}
                className={activeStage === tab.stage ? "active" : ""}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="project-directory-toolbar">
            <label>
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by society, area or status"
                aria-label="Search projects"
              />
            </label>
            <span>
              {visibleProjects.length}{" "}
              {visibleProjects.length === 1 ? "project" : "projects"} found
            </span>
          </div>
          {visibleProjects.length ? (
            <div className="working-project-grid">
              {visibleProjects.map((item) => (
                <article key={item.name}>
                  <div>
                    <span className="stitch-status">{item.status}</span>
                    <small>{item.scale}</small>
                  </div>
                  <h2>{item.name}</h2>
                  <p className="working-project-location">
                    <MapPin size={14} /> {item.location}
                  </p>
                  <p>{item.detail}</p>
                  <dl>
                    <div>
                      <dt>Building age</dt>
                      <dd>{item.age}</dd>
                    </div>
                    <div>
                      <dt>Homes</dt>
                      <dd>{item.homes}</dd>
                    </div>
                    <div>
                      <dt>Site area</dt>
                      <dd>{item.area}</dd>
                    </div>
                  </dl>
                  <Link href="/contact">
                    Request project details <ArrowUpRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="working-empty">
              <Building2 size={30} />
              <h2>
                {search
                  ? "No matching projects found."
                  : "No public projects in this stage yet."}
              </h2>
              <p>
                {search
                  ? "Try another society name, locality or status."
                  : "New verified opportunities will appear here after society approval."}
              </p>
              {search ? (
                <button type="button" onClick={() => setSearch("")}>
                  Clear search
                </button>
              ) : (
                <Link href="/assessment">Post a society opportunity</Link>
              )}
            </div>
          )}
        </section>
      </main>
      <footer className="stitch-footer">
        <div>
          <Logo />
          <p>Renew. Connect. Redevelop.</p>
        </div>
        <div>
          <Link href="/projects">Projects</Link>
          <Link href="/knowledge-centre">Knowledge centre</Link>
          <Link href="/about">About NIRMAQ</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <small>© {new Date().getFullYear()} NIRMAQ · Mumbai</small>
        <p>
          Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </footer>
    </div>
  );
}

const directoryCategoryLabels = ["All", ...organizationCategories] as const;

function OrganizationMonogram({
  organization,
}: {
  organization: Organization;
}) {
  const initials = organization.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="ecosystem-monogram"
      aria-label={`${organization.name} logo not provided`}
    >
      {initials}
    </span>
  );
}

function EcosystemFooter() {
  return (
    <footer className="stitch-footer">
      <div>
        <Logo />
        <p>Renew. Connect. Redevelop.</p>
      </div>
      <div>
        <Link href="/ecosystem">Ecosystem</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/knowledge-centre">Knowledge centre</Link>
        <Link href="/contact">Contact</Link>
      </div>
      <small>© {new Date().getFullYear()} NIRMAQ · Mumbai</small>
      <p>
        Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </footer>
  );
}

function EcosystemDirectory() {
  const [location] = useLocation();
  const requestedCategory = new URLSearchParams(
    location.split("?")[1] || "",
  ).get("category");
  const initialCategory = organizationCategories.includes(
    requestedCategory as (typeof organizationCategories)[number],
  )
    ? requestedCategory!
    : "All";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [category, setCategory] = useState(initialCategory);
  const [place, setPlace] = useState("All");
  const [service, setService] = useState("All");
  const [redevelopmentType, setRedevelopmentType] = useState("All");
  const [status, setStatus] = useState("All");

  const options = useMemo(
    () => ({
      places: [
        "All",
        ...Array.from(
          new Set(organizations.map((item) => item.location)),
        ).sort(),
      ],
      services: [
        "All",
        ...Array.from(
          new Set(organizations.flatMap((item) => item.services)),
        ).sort(),
      ],
      types: [
        "All",
        ...Array.from(
          new Set(organizations.flatMap((item) => item.redevelopmentTypes)),
        ).sort(),
      ],
    }),
    [],
  );

  const filtered = useMemo(
    () =>
      organizations.filter((item) => {
        const searchable = [
          item.name,
          item.category,
          item.location,
          ...item.areasServed,
          ...item.specializations,
          ...item.services,
        ]
          .join(" ")
          .toLowerCase();
        return (
          (!deferredSearch || searchable.includes(deferredSearch)) &&
          (category === "All" || item.category === category) &&
          (place === "All" || item.location === place) &&
          (service === "All" || item.services.includes(service)) &&
          (redevelopmentType === "All" ||
            item.redevelopmentTypes.includes(redevelopmentType)) &&
          (status === "All" || item.profileStatus === status)
        );
      }),
    [category, deferredSearch, place, redevelopmentType, service, status],
  );

  const reset = () => {
    setSearch("");
    setCategory("All");
    setPlace("All");
    setService("All");
    setRedevelopmentType("All");
    setStatus("All");
  };
  const hasFilters =
    Boolean(search) ||
    category !== "All" ||
    place !== "All" ||
    service !== "All" ||
    redevelopmentType !== "All" ||
    status !== "All";

  return (
    <div className="marketing-site public-content-page renova-public-experience working-page ecosystem-page">
      <PublicWorkingHeader />
      <main id="main-content">
        <section className="ecosystem-hero">
          <div className="ecosystem-hero-grid" aria-hidden="true" />
          <div className="ecosystem-hero-copy">
            <p>NIRMAQ ecosystem directory · Mumbai</p>
            <h1>
              Explore the <span>Redevelopment Ecosystem.</span>
            </h1>
            <div>
              Find developers, PMCs and professionals across Mumbai’s
              redevelopment ecosystem — in one place.
            </div>
          </div>
          <div className="ecosystem-hero-stat">
            <strong>{organizations.length}</strong>
            <span>public profiles with source links</span>
          </div>
        </section>

        <section className="ecosystem-directory-shell">
          <div className="ecosystem-search-panel">
            <label className="ecosystem-search">
              <Search size={22} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search developers, PMCs, architects or redevelopment professionals..."
                aria-label="Search the redevelopment ecosystem"
              />
            </label>
            <div
              className="ecosystem-category-filters"
              aria-label="Organization categories"
            >
              {directoryCategoryLabels.map((label) => (
                <button
                  type="button"
                  key={label}
                  className={category === label ? "active" : ""}
                  onClick={() => setCategory(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ecosystem-secondary-filters">
              <label>
                <span>Location</span>
                <select
                  value={place}
                  onChange={(event) => setPlace(event.target.value)}
                >
                  {options.places.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Service</span>
                <select
                  value={service}
                  onChange={(event) => setService(event.target.value)}
                >
                  {options.services.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Redevelopment type</span>
                <select
                  value={redevelopmentType}
                  onChange={(event) => setRedevelopmentType(event.target.value)}
                >
                  {options.types.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Verified status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="All">All statuses</option>
                  <option value="public">Public profile</option>
                  <option value="verified">NIRMAQ verified</option>
                </select>
              </label>
            </div>
          </div>

          <div className="ecosystem-results-bar">
            <div>
              <strong>{filtered.length}</strong>
              <span>
                {filtered.length === 1 ? "organization" : "organizations"} found
              </span>
            </div>
            {hasFilters && (
              <button type="button" onClick={reset}>
                <RotateCcw size={14} /> Reset filters
              </button>
            )}
          </div>
          <div className="ecosystem-source-note">
            <ShieldCheck size={17} />
            <p>
              <strong>Neutral, source-backed directory</strong>
              <span>
                Profiles are compiled from official public sources and remain
                PUBLIC PROFILE until independently verified by NIRMAQ. Database
                reviewed {organizationDataVersion}.
              </span>
            </p>
          </div>
          {filtered.length ? (
            <div className="ecosystem-card-grid">
              {filtered.map((organization) => (
                <article className="ecosystem-card" key={organization.slug}>
                  <div className="ecosystem-card-top">
                    <OrganizationMonogram organization={organization} />
                    <span
                      className={cn(
                        "ecosystem-status",
                        organization.profileStatus === "verified" && "verified",
                      )}
                    >
                      {organization.profileStatus === "verified" ? (
                        <>
                          <BadgeCheck size={13} /> NIRMAQ VERIFIED
                        </>
                      ) : (
                        "PUBLIC PROFILE"
                      )}
                    </span>
                  </div>
                  <div className="ecosystem-card-title">
                    <p>{organization.category}</p>
                    <h2>{organization.name}</h2>
                    <span>
                      <MapPin size={14} /> {organization.location}
                    </span>
                  </div>
                  <div className="ecosystem-tags">
                    {organization.specializations.slice(0, 3).map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                  <dl>
                    <div>
                      <dt>Areas served</dt>
                      <dd>
                        {organization.areasServed.join(", ") ||
                          "Information not yet provided"}
                      </dd>
                    </div>
                    <div>
                      <dt>Services</dt>
                      <dd>
                        {organization.services.join(", ") ||
                          "Information not yet provided"}
                      </dd>
                    </div>
                  </dl>
                  <div className="ecosystem-card-actions">
                    <Link href={`/ecosystem/${organization.slug}`}>
                      View Profile <ArrowUpRight size={14} />
                    </Link>
                    <a
                      href={organization.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website <ExternalLink size={13} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="working-empty ecosystem-empty">
              <Search size={30} />
              <h2>No matching organizations.</h2>
              <p>Try a broader search or reset the directory filters.</p>
              <button type="button" onClick={reset}>
                Reset filters
              </button>
            </div>
          )}
        </section>

        <section className="ecosystem-list-cta">
          <div>
            <p>For developers, PMCs and specialists</p>
            <h2>List your organization on NIRMAQ.</h2>
            <span>
              Send your organization details to the NIRMAQ team for review.
            </span>
          </div>
          <Link href="/contact" className="stitch-primary-button">
            List Your Organization on NIRMAQ <ArrowUpRight size={15} />
          </Link>
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}

function InformationValue({
  values,
  children,
}: {
  values?: string[];
  children?: ReactNode;
}) {
  if (values?.length)
    return (
      <>
        {values.map((value) => (
          <span className="organization-detail-chip" key={value}>
            {value}
          </span>
        ))}
      </>
    );
  return (
    <span className="organization-information-missing">
      {children || "Information not yet provided"}
    </span>
  );
}

function OrganizationProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const organization = getOrganization(slug);
  if (!organization) return <NotFound />;
  return (
    <div className="marketing-site public-content-page renova-public-experience working-page organization-profile-page">
      <PublicWorkingHeader />
      <main id="main-content">
        <section className="organization-profile-hero">
          <Link href="/ecosystem" className="public-page-back">
            <ArrowLeft size={14} /> Ecosystem directory
          </Link>
          <div className="organization-profile-heading">
            <OrganizationMonogram organization={organization} />
            <div>
              <span
                className={cn(
                  "ecosystem-status",
                  organization.profileStatus === "verified" && "verified",
                )}
              >
                {organization.profileStatus === "verified" ? (
                  <>
                    <BadgeCheck size={13} /> NIRMAQ VERIFIED
                  </>
                ) : (
                  "PUBLIC PROFILE"
                )}
              </span>
              <p>{organization.category}</p>
              <h1>{organization.name}</h1>
              <div>
                <MapPin size={15} /> {organization.location}
              </div>
            </div>
          </div>
          <p className="organization-profile-disclaimer">
            This profile is compiled from public information and has not been
            independently verified by NIRMAQ.
          </p>
        </section>
        <section className="organization-profile-layout">
          <div className="organization-profile-content">
            <article>
              <p>01 · Overview</p>
              <h2>Overview</h2>
              <div>
                {organization.overview || "Information not yet provided"}
              </div>
            </article>
            <article>
              <p>02 · Services</p>
              <h2>Redevelopment services</h2>
              <div className="organization-detail-chips">
                <InformationValue values={organization.services} />
              </div>
            </article>
            <article>
              <p>03 · Specializations</p>
              <h2>Specializations</h2>
              <div className="organization-detail-chips">
                <InformationValue values={organization.specializations} />
              </div>
            </article>
            <article>
              <p>04 · Locations</p>
              <h2>Areas served</h2>
              <div className="organization-detail-chips">
                <InformationValue values={organization.areasServed} />
              </div>
            </article>
            <article>
              <p>05 · Projects</p>
              <h2>Redevelopment projects</h2>
              <div className="organization-detail-chips">
                <InformationValue values={organization.projects} />
              </div>
            </article>
            <article>
              <p>06 · Company information</p>
              <h2>Company information</h2>
              <div>
                {organization.companyInformation ||
                  "Information not yet provided"}
              </div>
            </article>
          </div>
          <aside className="organization-profile-aside">
            <div>
              <p>Contact / website</p>
              <a href={organization.website} target="_blank" rel="noreferrer">
                Visit official website <ExternalLink size={15} />
              </a>
            </div>
            <div className="organization-source-card">
              <p>Public sources</p>
              {organization.sources.map((source) => (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  key={source.url}
                >
                  <span>
                    {source.title}
                    <small>
                      Official website · reviewed {source.reviewedAt}
                    </small>
                  </span>
                  <ExternalLink size={15} />
                </a>
              ))}
            </div>
            <div className="organization-claim-card">
              <ShieldCheck size={22} />
              <h2>Is this your company?</h2>
              <p>
                Claim this profile to submit accurate company information and
                begin NIRMAQ verification.
              </p>
              <Link href="/contact">
                Claim this profile <ArrowUpRight size={15} />
              </Link>
            </div>
            <Link href="/contact" className="organization-list-link">
              List Your Organization on NIRMAQ <ArrowUpRight size={15} />
            </Link>
          </aside>
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}

const registrationCopy: Record<
  string,
  { eyebrow: string; title: string; detail: string }
> = {
  Developer: {
    eyebrow: "Developer registration",
    title: "Join NIRMAQ as a verified developer.",
    detail:
      "Tell us about your organisation, redevelopment experience and preferred opportunities.",
  },
  PMC: {
    eyebrow: "PMC registration",
    title: "Bring structure to society redevelopment.",
    detail:
      "Share your feasibility, tendering, project management and oversight capabilities.",
  },
  Architect: {
    eyebrow: "Architect registration",
    title: "Shape Mumbai’s next generation of communities.",
    detail:
      "Introduce your practice, redevelopment portfolio and planning expertise.",
  },
  Contact: {
    eyebrow: "Contact NIRMAQ",
    title: "Tell us where you are in the journey.",
    detail:
      "Share a few details and the NIRMAQ team will understand the right next conversation.",
  },
};

function NetworkRegistrationPage({
  role,
}: {
  role: "Developer" | "PMC" | "Architect" | "Contact";
}) {
  const copy = registrationCopy[role];
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({
    name: "",
    organisation: "",
    email: "",
    phone: "",
    city: "Mumbai",
    experience: "",
    interest: role === "Contact" ? "Housing Society" : role,
    message: "",
    consent: false,
  });
  const setField = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          organizationName: form.organisation,
          email: form.email,
          phone: form.phone,
          city: form.city,
          actorType: role === "Contact" ? form.interest : role,
          experienceYears: role === "Contact" ? null : Number(form.experience),
          message: form.message,
          consent: form.consent,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to submit your request.",
        );
      setSubmitted(result.reference);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error
          ? cause.message
          : "Unable to submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted)
    return (
      <div className="marketing-site public-content-page renova-public-experience working-page">
        <PublicWorkingHeader />
        <main className="working-success">
          <span>
            <CheckCircle2 size={34} />
          </span>
          <p>Details received</p>
          <h1>Thank you, {form.name}.</h1>
          <div>
            Your NIRMAQ reference is <strong>{submitted}</strong>. Your
            information has been saved and is ready for review.
          </div>
          <Link href="/" className="stitch-primary-button">
            Return to NIRMAQ home <ArrowUpRight size={15} />
          </Link>
        </main>
      </div>
    );

  return (
    <div className="marketing-site public-content-page renova-public-experience working-page">
      <PublicWorkingHeader />
      <main className="working-form-page">
        <section className="working-form-intro">
          <p>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <span>{copy.detail}</span>
          <div>
            <ShieldCheck size={19} />
            <p>
              Your information remains private and is only used to review your
              NIRMAQ request.
            </p>
          </div>
        </section>
        <form className="working-form" onSubmit={submit}>
          <div className="working-form-heading">
            <span>NIRMAQ intake</span>
            <h2>
              {role === "Contact"
                ? "Start a conversation"
                : "Create your profile"}
            </h2>
            <p>Complete the details below. Fields marked * are required.</p>
          </div>
          <div className="working-form-grid">
            <label>
              Full name *
              <input
                required
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="Your full name"
              />
            </label>
            <label>
              Organisation / Society *
              <input
                required
                value={form.organisation}
                onChange={(event) =>
                  setField("organisation", event.target.value)
                }
                placeholder={
                  role === "Contact"
                    ? "Society or company name"
                    : "Registered organisation name"
                }
              />
            </label>
            <label>
              Email address *
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                placeholder="name@company.com"
              />
            </label>
            <label>
              Mobile number *
              <input
                required
                inputMode="tel"
                pattern="[0-9+ ()-]{10,}"
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
                placeholder="+91 98765 43210"
              />
            </label>
            <label>
              City / Primary market *
              <input
                required
                value={form.city}
                onChange={(event) => setField("city", event.target.value)}
              />
            </label>
            {role === "Contact" ? (
              <label>
                I represent *
                <select
                  required
                  value={form.interest}
                  onChange={(event) => setField("interest", event.target.value)}
                >
                  <option>Housing Society</option>
                  <option>Developer</option>
                  <option>PMC</option>
                  <option>Architect</option>
                  <option>Legal / Other Professional</option>
                </select>
              </label>
            ) : (
              <label>
                Years of relevant experience *
                <input
                  required
                  type="number"
                  min="0"
                  value={form.experience}
                  onChange={(event) =>
                    setField("experience", event.target.value)
                  }
                  placeholder="e.g. 8"
                />
              </label>
            )}
            <label className="working-field-wide">
              How can NIRMAQ help? *
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(event) => setField("message", event.target.value)}
                placeholder="Tell us about your projects, requirement or the opportunity you are looking for."
              />
            </label>
            <label className="working-consent working-field-wide">
              <input
                required
                type="checkbox"
                checked={form.consent}
                onChange={(event) => setField("consent", event.target.checked)}
              />
              <span>
                I confirm these details are accurate and permit NIRMAQ to
                contact me about this request.
              </span>
            </label>
          </div>
          {submitError && <p role="alert">{submitError}</p>}
          <button
            type="submit"
            className="stitch-primary-button"
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit to NIRMAQ"} <Send size={15} />
          </button>
        </form>
      </main>
    </div>
  );
}

const frequentlyAskedQuestions = [
  [
    "When should a society consider redevelopment?",
    "A society can begin with a feasibility review when its building has structural, functional or long-term value concerns. The first step is understanding the property and member priorities, not selecting a developer immediately.",
  ],
  [
    "What information is needed to register a society?",
    "Basic society details, location, member count, building age, property context, current documents and the services required are enough to begin.",
  ],
  [
    "How does NIRMAQ verify developers and professionals?",
    "Public profiles are sourced from public information. A listing is not a NIRMAQ verification or endorsement. Only profiles with an actual NIRMAQ verification status may be presented as verified.",
  ],
  [
    "Does NIRMAQ replace a PMC, architect or legal advisor?",
    "No. NIRMAQ organises requirements, discovery and connections. Societies should still appoint qualified independent professionals for technical and legal advice.",
  ],
  [
    "How are society details protected?",
    "Sensitive documents and contact information should only be shared after permission and an approved introduction. Public listings use limited opportunity information.",
  ],
  [
    "Can developers search opportunities by location and stage?",
    "Developer and PMC accounts can search published society opportunities by keyword and location in the authenticated marketplace. Public registration is currently closed.",
  ],
];

function FaqPage() {
  const [openIndex, setOpenIndex] = useState(0);
  const [search, setSearch] = useState("");
  const visible = frequentlyAskedQuestions.filter(([question, answer]) =>
    (question + " " + answer).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="marketing-site public-content-page renova-public-experience working-page">
      <PublicWorkingHeader />
      <main id="main-content">
        <section className="working-hero faq-hero">
          <div>
            <p>Knowledge centre · FAQs</p>
            <h1>Redevelopment questions, answered clearly.</h1>
            <span>
              Search practical guidance for societies, developers and
              professionals.
            </span>
          </div>
        </section>
        <section className="faq-shell">
          <label className="faq-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions"
              aria-label="Search questions"
            />
          </label>
          <div className="working-faq-list">
            {visible.map(([question, answer], index) => (
              <article
                key={question}
                className={openIndex === index ? "open" : ""}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                  aria-expanded={openIndex === index}
                >
                  <span>{question}</span>
                  <ChevronDown size={19} />
                </button>
                {openIndex === index && <p>{answer}</p>}
              </article>
            ))}
          </div>
          {!visible.length && (
            <div className="working-empty">
              <CircleHelp size={30} />
              <h2>No matching answer found.</h2>
              <p>Try a broader term or contact the NIRMAQ team.</p>
              <Link href="/contact">Ask NIRMAQ</Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PublicPage({ page }: { page: PublicPageData }) {
  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-info-page"
      >
        <span className="experience-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        <div className="experience-benefits">
          {page.highlights.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              {item.href && <Link href={item.href}>Read {item.title} →</Link>}
            </article>
          ))}
        </div>
        {page.showTentativeFeasibility && <TentativeFeasibility />}
        <Link className="experience-button" href={page.ctaHref}>
          {page.ctaLabel}
          <ArrowRight size={16} />
        </Link>
      </main>
      <ExperienceFooter />
    </div>
  );
}

function Router() {
  const [location, navigate] = useLocation();
  const pathname = location.split("?")[0];
  const legacyApplication =
    pathname === "/platform" ||
    (pathname.startsWith("/platform/") && pathname !== "/platform/live") ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/workspace" ||
    pathname.startsWith("/project/") ||
    pathname === "/assessment" ||
    pathname === "/join" ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/projects");
  useEffect(() => {
    if (!legacyApplication) return;
    const view =
      pathname.startsWith("/projects") || pathname.includes("opportunities")
        ? "?view=opportunities"
        : pathname === "/assessment" || pathname.includes("feasibility")
          ? "?view=feasibility"
          : pathname.startsWith("/join")
            ? "?mode=start"
            : "";
    navigate(`/platform/live${view}`, { replace: true });
  }, [legacyApplication, pathname, navigate]);
  // Search engines see one served page for every route, so the title,
  // description and canonical URL are set per route on navigation.
  useEffect(() => {
    const meta = getPageMeta(pathname);
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", meta.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical)
      canonical.setAttribute("href", getCanonicalUrl(pathname));
  }, [pathname]);
  if (legacyApplication)
    return <LoadingPage label="Opening your NIRMAQ workspace" />;
  if (pathname === "/") return <MarketingHome />;
  if (pathname === "/spike/homepage-stage0")
    return (
      <Suspense fallback={<LoadingPage label="Loading the Stage 0 design spike" />}>
        <Stage0Spike />
      </Suspense>
    );
  if (pathname === "/platform/live")
    return (
      <Suspense
        fallback={<LoadingPage label="Opening your NIRMAQ workspace" />}
      >
        <LiveWorkspace />
      </Suspense>
    );
  if (pathname === "/professionals") return <EcosystemDirectory />;
  if (pathname.startsWith("/ecosystem/"))
    return (
      <Route path="/ecosystem/:slug" component={OrganizationProfilePage} />
    );
  if (pathname === "/ecosystem") return <EcosystemDirectory />;
  if (pathname === "/contact") return <ContactPage />;
  if (pathname === "/privacy") return <PrivacyPage page="privacy" />;
  if (pathname === "/terms") return <PrivacyPage page="terms" />;
  if (pathname === "/grievance") return <PrivacyPage page="grievance" />;
  if (pathname === "/knowledge-centre/faqs") return <FaqPage />;
  if (pathname === "/knowledge-centre/dcpr-2034") return <DcprGuidePage />;
  if (pathname === "/feasibility-check") return <FeasibilityCheckPage />;
  if (pathname === "/societies/intake-form") return <IntakeFormPage />;
  if (pathname === "/societies/documents")
    return <FeasibilityDocumentsPage />;
  if (pathname === "/feasibility-dashboard")
    return <FeasibilityDashboardPage />;
  if (pathname === "/get-started") return <GetStartedPage />;
  if (pathname === "/regulations")
    return (
      <div className="renova-experience">
        <ExperienceHeader />
        <main
          id="main-content"
          className="experience-container experience-contact-page"
        >
          <Regulations />
        </main>
        <ExperienceFooter />
      </div>
    );
  const publicPage = publicPageMap[pathname];
  if (publicPage) return <PublicPage page={publicPage} />;
  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-contact-page"
      >
        <h1>We couldn’t find this page.</h1>
        <p>Continue from the NIRMAQ homepage or your workspace.</p>
        <Link className="experience-button" href="/">
          Go to homepage
        </Link>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
