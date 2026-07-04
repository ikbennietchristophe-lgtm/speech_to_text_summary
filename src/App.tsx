import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Mic, 
  Square, 
  Pause, 
  Play, 
  Trash2, 
  LogOut, 
  Search, 
  Tag, 
  Folder, 
  Calendar, 
  Clock, 
  Copy, 
  Check, 
  Sparkles, 
  Languages, 
  Volume2, 
  AlertTriangle 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { Recording } from './types';

// Categories translations
const CATEGORIES: { [key: string]: { nl: string; en: string; color: string } } = {
  work: { nl: 'Werk', en: 'Work', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  personal: { nl: 'Persoonlijk', en: 'Personal', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ideas: { nl: 'Ideeën', en: 'Ideas', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  other: { nl: 'Overig', en: 'Other', color: 'bg-slate-100 text-slate-800 border-slate-200' }
};

export default function App() {
  // Localization state
  const [lang, setLang] = useState<'nl' | 'en'>('nl');

  // Auth & Database status
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // App Data State
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<'record' | 'history'>('record');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingCategory, setRecordingCategory] = useState<string>('work');

  // UI Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [copiedField, setCopiedField] = useState<'transcript' | 'summary' | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Audio / Media Ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Translatable texts
  const t = {
    nl: {
      appName: 'Stemopname Samenvatter',
      tagline: 'Neem spraak op, transcribeer en vat direct samen met Gemini AI',
      loadingDb: 'Database of autorisatie is niet volledig geïnitialiseerd. Wacht even en probeer het opnieuw.',
      loginTitle: 'Welkom bij Voice Recording Summarizer',
      loginSubtitle: 'Log in met uw Google-account om veilige stemopnames te maken, te transcriberen en direct samen te vatten met AI.',
      loginButton: 'Log in met Google',
      signOut: 'Uitloggen',
      newRecording: 'Nieuwe Opname',
      recordTitlePlaceholder: 'Geef uw opname een titel...',
      startRecord: 'Start Opname',
      stopRecord: 'Stop Opname',
      pauseRecord: 'Pauzeer',
      resumeRecord: 'Hervat',
      recordingActive: 'Bezig met opnemen...',
      recordingPaused: 'Opname gepauzeerd',
      duration: 'Duur',
      category: 'Categorie',
      selectCategory: 'Selecteer categorie',
      allCategories: 'Alle Categorieën',
      searchPlaceholder: 'Zoeken in opnames...',
      noRecordings: 'Nog geen opnames gevonden. Begin met uw eerste opname hierboven!',
      noSearchResults: 'Geen opnames gevonden voor uw zoekopdracht.',
      processing: 'AI is bezig met verwerken...',
      stepUpload: 'Audio uploaden naar de server...',
      stepTranscribe: 'Spraak analyseren en transcriberen...',
      stepSummarize: 'Hoofdpunten en samenvatting genereren...',
      transcriptTab: 'Transcriptie',
      summaryTab: 'AI Samenvatting',
      copyTranscript: 'Kopieer transcriptie',
      copySummary: 'Kopieer samenvatting',
      copied: 'Gekopieerd!',
      deleteRecording: 'Verwijder opname',
      deleteConfirm: 'Weet u zeker dat u deze opname wilt verwijderen?',
      backToList: 'Terug naar lijst',
      errorRecording: 'Kon geen opname starten. Controleer uw microfoonrechten.',
      errorProcessing: 'Er is een fout opgetreden bij het verwerken van de audio.',
      errorFirebase: 'Fout bij synchroniseren met database.',
      all: 'Alle',
      tagsLabel: 'Labels',
      createdAtLabel: 'Gemaakt op'
    },
    en: {
      appName: 'Voice Recording Summarizer',
      tagline: 'Record, transcribe, and summarize your voice notes with Gemini AI',
      loadingDb: 'Database or authentication is not fully initialized. Please wait a moment and try again.',
      loginTitle: 'Welcome to Voice Recording Summarizer',
      loginSubtitle: 'Sign in with Google to securely record audio, transcribe speech, and get AI-powered structured summaries.',
      loginButton: 'Sign in with Google',
      signOut: 'Sign Out',
      newRecording: 'New Recording',
      recordTitlePlaceholder: 'Give your recording a title...',
      startRecord: 'Start Recording',
      stopRecord: 'Stop Recording',
      pauseRecord: 'Pause',
      resumeRecord: 'Resume',
      recordingActive: 'Recording audio...',
      recordingPaused: 'Recording paused',
      duration: 'Duration',
      category: 'Category',
      selectCategory: 'Select category',
      allCategories: 'All Categories',
      searchPlaceholder: 'Search recordings...',
      noRecordings: 'No recordings found. Start by making your first recording above!',
      noSearchResults: 'No recordings found matching your search.',
      processing: 'AI is processing...',
      stepUpload: 'Uploading audio chunks...',
      stepTranscribe: 'Transcribing speech to text...',
      stepSummarize: 'Extracting key summary points...',
      transcriptTab: 'Transcription',
      summaryTab: 'AI Summary',
      copyTranscript: 'Copy transcription',
      copySummary: 'Copy summary',
      copied: 'Copied!',
      deleteRecording: 'Delete recording',
      deleteConfirm: 'Are you sure you want to delete this recording?',
      backToList: 'Back to list',
      errorRecording: 'Could not start recording. Please check microphone permissions.',
      errorProcessing: 'An error occurred while analyzing the audio.',
      errorFirebase: 'Database sync failure occurred.',
      all: 'All',
      tagsLabel: 'Tags',
      createdAtLabel: 'Created on'
    }
  }[lang];

  // Auth Observer
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setIsAuthLoading(false);
      }, (error) => {
        console.error('Firebase Auth state error:', error);
        setInitError(error.message);
        setIsAuthLoading(false);
      });
      return () => unsubscribe();
    } catch (e: any) {
      console.error('Error starting auth listener:', e);
      setInitError(e.message || 'Firebase Auth is failed to load.');
      setIsAuthLoading(false);
    }
  }, []);

  // Fetch recordings from Firestore
  useEffect(() => {
    if (!user) {
      setRecordings([]);
      return;
    }

    const q = query(
      collection(db, 'recordings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Recording[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Recording);
      });
      setRecordings(fetched);
    }, (error) => {
      console.error('Firestore snapshot read error:', error);
      setErrorBanner(t.errorFirebase + ': ' + error.message);
    });

    return () => unsubscribe();
  }, [user, lang]);

  // Audio Duration Timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  // Canvas waveform renderer
  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current || !dataArrayRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    analyser.getByteFrequencyData(dataArray as any);

    ctx.clearRect(0, 0, width, height);

    // Render beautiful audio level pulsing visualizer
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const pulseRadius = Math.min(height / 2, 20 + (average / 255) * (height / 2));

    // Dynamic gradient
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 5,
      width / 2, height / 2, pulseRadius
    );
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.7)'); // Indigo-500
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)'); // Purple-500
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0)'); // Pink-500

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, pulseRadius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw secondary rings
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, pulseRadius * 0.7, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  // Start Voice Recording
  const startRecording = async () => {
    setErrorBanner(null);
    audioChunksRef.current = [];
    setRecordingDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Web Audio API Analyser for real-time level monitoring
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      // Start WebM / WAV audio capture
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/ogg' };
      }
      if (!MediaRecorder.isTypeSupported('audio/ogg')) {
        options = { mimeType: '' }; // Fallback to browser default
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Cleanup active stream tracks
        stream.getTracks().forEach(track => track.stop());
        if (audioCtx.state !== 'closed') {
          audioCtx.close();
        }
        await processAndSummarizeAudio();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);

      // Trigger visualizer animation loop
      setTimeout(() => {
        drawWaveform();
      }, 100);

    } catch (error: any) {
      console.error('Failed to access microphone:', error);
      setErrorBanner(t.errorRecording);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  // Pause / Resume Recording
  const togglePause = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  // Convert blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Send to AI API & Save Result
  const processAndSummarizeAudio = async () => {
    if (audioChunksRef.current.length === 0) return;

    setIsProcessing(true);
    setProcessingStep(t.stepUpload);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
      const audioBase64 = await blobToBase64(audioBlob);

      setProcessingStep(t.stepTranscribe);
      
      // Express full-stack endpoint
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type,
          language: lang,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server processing failed');
      }

      setProcessingStep(t.stepSummarize);
      const aiResult = await response.json();

      // Clean default title
      const finalTitle = recordingTitle.trim() || `${t.newRecording} - ${new Date().toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')}`;

      // Save into firestore under User's UID
      const newRecordingDoc = {
        userId: user!.uid,
        title: finalTitle,
        createdAt: Date.now(),
        duration: recordingDuration,
        transcript: aiResult.transcript || 'Geen transcriptie beschikbaar.',
        summary: aiResult.summary || 'Geen samenvatting gegenereerd.',
        category: recordingCategory,
        tags: [recordingCategory, lang]
      };

      const docRef = await addDoc(collection(db, 'recordings'), newRecordingDoc);

      // Trigger Confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Clear input fields
      setRecordingTitle('');
      
      // Auto-select the newly added recording
      setSelectedRecording({ id: docRef.id, ...newRecordingDoc } as Recording);
      setMobileTab('history');

    } catch (error: any) {
      console.error('Error processing audio summary:', error);
      setErrorBanner(t.errorProcessing + ': ' + error.message);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Delete recording from Firestore
  const handleDelete = async (recId: string) => {
    if (!confirm(t.deleteConfirm)) return;
    try {
      await deleteDoc(doc(db, 'recordings', recId));
      if (selectedRecording?.id === recId) {
        setSelectedRecording(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `recordings/${recId}`);
    }
  };

  // Copy field utility
  const handleCopy = (text: string, field: 'transcript' | 'summary') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Google Sign-In helper
  const handleLogin = async () => {
    setErrorBanner(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google login failed:', error);
      setErrorBanner(error.message);
    }
  };

  // Logout helper
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedRecording(null);
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  // Format Duration string
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Render auth/initialization loading screen
  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-600 p-6" id="loading-container">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" id="loading-spinner"></div>
        <p className="text-center font-medium max-w-md text-slate-700" id="loading-text">
          {t.loadingDb}
        </p>
      </div>
    );
  }

  // Render sign-in page if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8" id="login-layout">
        <div className="sm:mx-auto sm:w-full sm:max-w-md" id="login-header">
          {/* Language Switch */}
          <div className="flex justify-end mb-8" id="login-lang-switch">
            <button 
              onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 shadow-xs transition"
              id="toggle-lang-btn"
            >
              <Languages size={14} id="lang-icon" />
              <span>{lang === 'nl' ? 'English' : 'Nederlands'}</span>
            </button>
          </div>

          <div className="text-center" id="logo-branding">
            <div className="inline-flex items-center justify-center p-3.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-100 mb-6" id="brand-badge">
              <Mic size={32} id="brand-icon" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight" id="login-title">
              {lang === 'nl' ? 'Stemopname Samenvatter' : 'Voice Recording Summarizer'}
            </h1>
            <p className="mt-2 text-sm text-slate-500" id="login-subtitle">
              {lang === 'nl' ? 'Gepersonaliseerde AI-transcripts & samenvattingen' : 'Personalized AI transcripts & summaries'}
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md" id="login-card-container">
          <div className="bg-white py-10 px-8 shadow-sm border border-slate-200/80 rounded-2xl space-y-6" id="login-card">
            <p className="text-sm text-slate-600 text-center leading-relaxed" id="login-desc">
              {t.loginSubtitle}
            </p>

            {errorBanner && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-700 text-xs" id="login-error">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" id="error-alert-icon" />
                <span id="error-alert-text">{errorBanner}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full flex justify-center items-center gap-3 px-5 py-3.5 border border-slate-200 bg-white text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 shadow-xs active:scale-[0.99] transition"
              id="google-signin-button"
            >
              {/* Google G Logo SVG */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" id="google-svg">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{t.loginButton}</span>
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400" id="login-footer">
          &copy; {new Date().getFullYear()} Voice Recording Summarizer. All rights reserved.
        </div>
      </div>
    );
  }

  // Filtered recordings
  const filteredRecordings = recordings.filter(rec => {
    const matchesSearch = rec.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          rec.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          rec.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || rec.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" id="app-layout">
      {/* Dynamic Error Alerts */}
      {errorBanner && (
        <div className="bg-rose-600 text-white px-4 py-3 text-sm font-medium flex items-center justify-between shadow-md" id="error-toast">
          <div className="flex items-center gap-2" id="error-toast-body">
            <AlertTriangle size={18} id="toast-error-icon" />
            <span id="toast-error-text">{errorBanner}</span>
          </div>
          <button 
            onClick={() => setErrorBanner(null)}
            className="text-white hover:text-rose-100 font-bold px-2 py-0.5 rounded-lg text-xs"
            id="toast-close-btn"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Studio Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between" id="header-content">
          <div className="flex items-center gap-3" id="header-brand">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs" id="header-brand-badge">
              <Mic size={20} id="header-brand-icon" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight" id="header-title">{t.appName}</h1>
              <p className="text-slate-400 text-[10px] hidden sm:block" id="header-subtitle">{t.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-3" id="header-controls">
            {/* Bilingual Toggle */}
            <button 
              onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              id="header-lang-btn"
            >
              <Languages size={14} id="header-lang-icon" />
              <span>{lang.toUpperCase()}</span>
            </button>

            {/* Profile widget */}
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3" id="user-profile-widget">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'Profile'} className="h-8 w-8 rounded-full border border-slate-200" id="user-avatar" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs" id="user-avatar-placeholder">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-slate-700 hidden md:block" id="user-display-name">
                {user.displayName || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                title={t.signOut}
                id="sign-out-btn"
              >
                <LogOut size={16} id="sign-out-icon" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6" id="app-main">
        {/* Mobile Tab Switcher */}
        <div className="lg:hidden flex p-1 bg-slate-200/60 backdrop-blur-xs rounded-xl border border-slate-200/50" id="mobile-tabs">
          <button
            onClick={() => setMobileTab('record')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${mobileTab === 'record' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-950'}`}
            id="mobile-tab-record"
          >
            <Mic size={15} />
            <span>{t.newRecording}</span>
          </button>
          <button
            onClick={() => setMobileTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all relative ${mobileTab === 'history' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-950'}`}
            id="mobile-tab-history"
          >
            <Folder size={15} />
            <span>{lang === 'nl' ? 'Geschiedenis' : 'History'}</span>
            {recordings.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-indigo-100 text-indigo-700 rounded-full font-bold" id="mobile-history-badge">
                {recordings.length}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="app-grid">
          {/* Left Side: Recording Console */}
          <div className={`lg:col-span-5 space-y-6 ${mobileTab === 'record' ? 'block' : 'hidden lg:block'}`} id="recorder-panel">
          {/* Recorder Console Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 relative overflow-hidden" id="recorder-console">
            
            {/* Processing Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-10 text-center" id="processing-overlay">
                <div className="relative mb-6" id="processing-visual">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" id="processing-spinner"></div>
                  <Sparkles className="absolute inset-0 m-auto text-indigo-500 animate-pulse" size={24} id="processing-star-icon" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg" id="processing-title">{t.processing}</h3>
                <p className="text-sm text-slate-500 mt-2 font-medium" id="processing-step">{processingStep}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs" id="processing-sub">
                  {lang === 'nl' ? 'Gemini AI is bezig met transcriberen en samenvatten van de audio.' : 'Gemini AI is actively transcribing and summarizing the audio.'}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5" id="recorder-header">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-md" id="recorder-title">
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg" id="recorder-icon-container"><Mic size={16} id="header-mic-icon" /></span>
                {t.newRecording}
              </h2>
              {isRecording && (
                <span className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded-full animate-pulse" id="record-status-badge">
                  <span className="h-2 w-2 rounded-full bg-rose-600" id="record-dot"></span>
                  {isPaused ? t.recordingPaused : t.recordingActive}
                </span>
              )}
            </div>

            <div className="space-y-4" id="recorder-inputs">
              {/* Title Input */}
              <div id="input-title-group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5" id="title-label">
                  {lang === 'nl' ? 'Titel' : 'Title'}
                </label>
                <input
                  type="text"
                  value={recordingTitle}
                  onChange={(e) => setRecordingTitle(e.target.value)}
                  placeholder={t.recordTitlePlaceholder}
                  disabled={isRecording}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition text-sm"
                  id="recording-title-input"
                />
              </div>

              {/* Category & Tag */}
              <div className="grid grid-cols-2 gap-4" id="input-meta-grid">
                <div id="input-category-group">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5" id="category-label">
                    {t.category}
                  </label>
                  <select
                    value={recordingCategory}
                    onChange={(e) => setRecordingCategory(e.target.value)}
                    disabled={isRecording}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition text-xs font-medium"
                    id="recording-category-select"
                  >
                    {Object.entries(CATEGORIES).map(([key, config]) => (
                      <option key={key} value={key} id={`category-opt-${key}`}>
                        {lang === 'nl' ? config.nl : config.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div id="input-duration-group">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5" id="duration-label">
                    {t.duration}
                  </label>
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-xs flex items-center justify-center border-dashed font-bold" id="recording-timer-display">
                    <Clock size={14} className="mr-1.5 text-slate-400" id="timer-icon" />
                    <span>{formatTime(recordingDuration)}</span>
                  </div>
                </div>
              </div>

              {/* Waveform Visualizer Canvas */}
              <div className="h-32 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden relative" id="visualizer-container">
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-full" 
                  width={300} 
                  height={128}
                  id="audio-level-canvas"
                />
                {!isRecording && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-xs gap-1" id="visualizer-placeholder">
                    <Volume2 size={24} className="opacity-40" id="waveform-placeholder-icon" />
                    <span>{lang === 'nl' ? 'Druk op start om op te nemen' : 'Press start to record'}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2" id="recorder-buttons-group">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 active:scale-[0.98] transition"
                    id="start-recording-btn"
                  >
                    <Mic size={18} id="start-mic-icon" />
                    <span>{t.startRecord}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={togglePause}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 bg-white text-slate-700 font-semibold rounded-xl hover:bg-slate-50 active:scale-[0.98] transition"
                      id="pause-recording-btn"
                    >
                      {isPaused ? <Play size={16} id="resume-icon" /> : <Pause size={16} id="pause-icon" />}
                      <span>{isPaused ? t.resumeRecord : t.pauseRecord}</span>
                    </button>
                    <button
                      onClick={stopRecording}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 shadow-md shadow-rose-100 active:scale-[0.98] transition"
                      id="stop-recording-btn"
                    >
                      <Square size={16} id="stop-icon" />
                      <span>{t.stopRecord}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Saved Transcripts & Summaries list or details view */}
        <div className={`lg:col-span-7 space-y-6 ${mobileTab === 'history' ? 'block' : 'hidden lg:block'}`} id="dashboard-panel">
          {selectedRecording ? (
            /* Details View of Selected Recording */
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6" id="recording-details-view">
              
              {/* Back & Actions header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4" id="details-header">
                <button
                  onClick={() => setSelectedRecording(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition"
                  id="details-back-btn"
                >
                  &larr; {t.backToList}
                </button>

                <button
                  onClick={() => handleDelete(selectedRecording.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                  title={t.deleteRecording}
                  id="details-delete-btn"
                >
                  <Trash2 size={16} id="details-delete-icon" />
                </button>
              </div>

              {/* Title & Metadata */}
              <div className="space-y-2.5" id="details-metadata">
                <div className="flex flex-wrap items-center gap-2" id="details-categories-row">
                  <span className={`px-2.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider rounded-md ${CATEGORIES[selectedRecording.category]?.color || CATEGORIES.other.color}`} id="details-category-badge">
                    {lang === 'nl' ? CATEGORIES[selectedRecording.category]?.nl : CATEGORIES[selectedRecording.category]?.en}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 leading-tight" id="details-recording-title">
                  {selectedRecording.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400" id="details-info-row">
                  <span className="flex items-center gap-1" id="details-date">
                    <Calendar size={13} id="details-date-icon" />
                    <span>{t.createdAtLabel}: {new Date(selectedRecording.createdAt).toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US')}</span>
                  </span>
                  <span className="flex items-center gap-1" id="details-duration">
                    <Clock size={13} id="details-duration-icon" />
                    <span>{t.duration}: {formatTime(selectedRecording.duration)}</span>
                  </span>
                </div>
              </div>

              {/* BENTO GRID: Transcription & Summary side-by-side or stacked */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="bento-container">
                {/* Transcript Card */}
                <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-5 flex flex-col justify-between space-y-4" id="transcript-bento-card">
                  <div className="space-y-2" id="transcript-card-header">
                    <div className="flex items-center justify-between" id="transcript-header-row">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2" id="transcript-title">
                        <span className="h-2 w-2 rounded-full bg-slate-400" id="transcript-dot"></span>
                        {t.transcriptTab}
                      </h3>
                      <button
                        onClick={() => handleCopy(selectedRecording.transcript, 'transcript')}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md px-2.5 py-1.5 transition uppercase tracking-wider"
                        id="copy-transcript-btn"
                      >
                        {copiedField === 'transcript' ? (
                          <>
                            <Check size={11} id="check-icon-1" />
                            <span>{t.copied}</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} id="copy-icon-1" />
                            <span>{lang === 'nl' ? 'Kopieer' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto pr-1" id="transcript-body-text">
                      {selectedRecording.transcript}
                    </p>
                  </div>
                </div>

                {/* AI Summary Card */}
                <div className="bg-gradient-to-br from-indigo-50/20 via-purple-50/20 to-white border border-indigo-100 rounded-2xl p-5 flex flex-col justify-between space-y-4" id="summary-bento-card">
                  <div className="space-y-2" id="summary-card-header">
                    <div className="flex items-center justify-between" id="summary-header-row">
                      <h3 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5" id="summary-title">
                        <Sparkles size={14} className="text-indigo-600" id="summary-sparkle-icon" />
                        {t.summaryTab}
                      </h3>
                      <button
                        onClick={() => handleCopy(selectedRecording.summary, 'summary')}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md px-2.5 py-1.5 transition uppercase tracking-wider"
                        id="copy-summary-btn"
                      >
                        {copiedField === 'summary' ? (
                          <>
                            <Check size={11} id="check-icon-2" />
                            <span>{t.copied}</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} id="copy-icon-2" />
                            <span>{lang === 'nl' ? 'Kopieer' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-slate-700 text-xs leading-relaxed max-h-96 overflow-y-auto pr-1" id="summary-body-container">
                      {selectedRecording.summary.split('\n').map((line, idx) => {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                          return (
                            <div key={idx} className="flex items-start gap-2 my-1" id={`summary-bullet-${idx}`}>
                              <span className="text-indigo-500 mt-1 shrink-0">•</span>
                              <span>{trimmed.substring(1).trim()}</span>
                            </div>
                          );
                        }
                        return <p key={idx} className="my-1" id={`summary-text-${idx}`}>{line}</p>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Records List View */
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs" id="recordings-list-view">
              
              {/* Filtering & Searching Row */}
              <div className="space-y-4" id="list-controls">
                <div className="flex flex-col md:flex-row gap-3" id="filters-container">
                  {/* Search bar */}
                  <div className="relative flex-1" id="search-input-group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} id="search-icon" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition text-xs font-medium"
                      id="search-input"
                    />
                  </div>

                  {/* Category Filter */}
                  <div className="flex flex-wrap gap-1.5" id="category-filter-chips">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${selectedCategory === 'all' ? 'bg-slate-900 border-slate-900 text-white shadow-xs' : 'bg-slate-100 border-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      id="filter-chip-all"
                    >
                      {lang === 'nl' ? 'Alles' : 'All'}
                    </button>
                    {Object.entries(CATEGORIES).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedCategory(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${selectedCategory === key ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-slate-100 border-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        id={`filter-chip-${key}`}
                      >
                        {lang === 'nl' ? config.nl : config.en}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Saved Records list */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1" id="recordings-scroller">
                {filteredRecordings.length > 0 ? (
                  filteredRecordings.map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedRecording(rec)}
                      className="bg-slate-50/50 hover:bg-white border border-slate-200/60 hover:border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-4 cursor-pointer hover:shadow-xs active:scale-[0.99] transition"
                      id={`recording-row-${rec.id}`}
                    >
                      <div className="space-y-1 min-w-0" id={`recording-meta-${rec.id}`}>
                        <div className="flex flex-wrap items-center gap-1.5" id={`recording-badge-row-${rec.id}`}>
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${CATEGORIES[rec.category]?.color || CATEGORIES.other.color}`} id={`recording-badge-${rec.id}`}>
                            {lang === 'nl' ? CATEGORIES[rec.category]?.nl : CATEGORIES[rec.category]?.en}
                          </span>
                          <span className="text-[10px] text-slate-400" id={`recording-time-${rec.id}`}>{new Date(rec.createdAt).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-xs truncate" id={`recording-title-${rec.id}`}>
                          {rec.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-1" id={`recording-snippet-${rec.id}`}>
                          {rec.summary || rec.transcript}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" id={`recording-actions-${rec.id}`}>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md" id={`recording-duration-badge-${rec.id}`}>
                          <Clock size={11} id={`duration-icon-${rec.id}`} />
                          <span>{formatTime(rec.duration)}</span>
                        </span>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(rec.id);
                          }}
                          className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition"
                          id={`recording-delete-btn-${rec.id}`}
                        >
                          <Trash2 size={13} id={`recording-delete-icon-${rec.id}`} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2" id="empty-list-placeholder">
                    <Volume2 size={32} className="opacity-40 animate-pulse" id="empty-icon" />
                    <p className="text-xs font-semibold max-w-xs leading-normal" id="empty-text">
                      {searchQuery ? t.noSearchResults : t.noRecordings}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400" id="app-footer">
        &copy; {new Date().getFullYear()} Voice Recording Summarizer — Powered by Gemini AI.
      </footer>
    </div>
  );
}
