/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Pause, 
  Play, 
  Save, 
  Archive, 
  Trash2, 
  Folder, 
  FileText, 
  Mail, 
  Search, 
  Plus, 
  X, 
  LogOut, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  ChevronRight,
  Database,
  Volume2,
  Edit3
} from 'lucide-react';
import { googleSignIn, initAuth, logout } from './lib/firebase';
import { Recording } from './types';
import ReactMarkdown from 'react-markdown';

// Declare standard browser speech recognition
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const translations = {
  en: {
    title: "Speech to Text Summarizer",
    subtitle: "Record spoken notes, automatically transcribing and formatting them with Gemini, and filing records directly in your Google Drive.",
    permissionWarning: "Requires permission to store documents in Google Sheets and email summaries on your behalf.",
    signIn: "Sign in with Google",
    signingIn: "Signing in...",
    secureCloud: "Secure Cloud Processing",
    activeDatabase: "STT Database",
    signOut: "Sign Out",
    createNewSummary: "Create New Summary",
    searchPlaceholder: "Search recordings...",
    activeConversations: "Active Conversations",
    archivedFolders: "Archived Folders",
    refresh: "Refresh",
    loadingSpreadsheet: "Loading spreadsheet data...",
    noMatches: "No matches found",
    noMatchesSub: "Try adjusting your search criteria.",
    noSummaries: "No summaries yet",
    noSummariesSub: 'Tap "Create New Summary" to record your first dictation!',
    archiveEmpty: "Archive is empty",
    archiveEmptySub: "Summaries you archive will appear here.",
    archiveConfirm: (title: string) => `Are you sure you want to archive "${title}"?`,
    deleteConfirm: (title: string) => `Remove "${title}" from your mobile view? (The original data remains safe in Google Sheets)`,
    recordingsTab: "Recordings",
    archiveTab: "Archive",
    recordingActive: "Recording Conversation",
    recordingPaused: "Recording Paused",
    speakInstruction: "Start speaking to dictate text...",
    typeInstruction: "You can also type or paste content directly below if needed.",
    manualLabel: "Edit/Paste Text Manually (Optional)",
    manualPlaceholder: "Type or edit your dictation here...",
    summarizing: "Gemini Summarizing...",
    saveAndEmail: "Save & Email Summary",
    convoDetails: "Conversation Details",
    emailConfirmHeader: "Email Confirmation Status",
    recipient: "Recipient",
    subjectLine: "Subject Line",
    aiSummary: "Structured AI Summary",
    originalSpeech: "Original Speech Transcription",
    closeSummary: "Close Summary",
    archiveRecording: "Archive Recording",
    welcome: (name: string) => `Welcome, ${name}!`,
    databaseError: "Error configuring Google Sheet database",
    fetchError: "Failed to load recordings from Google Sheet",
    signedOut: "Signed out successfully",
    micNotSupported: "Web Speech API is not supported in this browser. Please type manually inside the textbox.",
    micDenied: "Microphone permission denied. Please grant permission or type text manually.",
    savedSuccess: "Summary successfully saved to Google Sheets and emailed!",
    updateSuccess: "Summary successfully updated in Google Sheets and emailed!",
    transcriptionEmpty: "The transcription is empty. Please speak or enter text manually before saving.",
    dbNotReady: "Database or authorization is not fully initialized. Please wait and try again.",
    initializingDb: "Initializing database in Google Drive...",
    confirmSignOut: "Are you sure you want to sign out?",
    reopenAndRecord: "Re-open & Record more",
    updateRecording: "Update & Email Summary",
    updating: "Gemini Updating...",
  },
  nl: {
    title: "Spraak-naar-tekst Samenvatter",
    subtitle: "Neem gesproken notities op, laat ze automatisch transcriberen en structureren door Gemini, en bewaar ze direct in uw Google Drive.",
    permissionWarning: "Vereist toestemming om documenten in Google Sheets op te slaan en samenvattingen namens u te e-mailen.",
    signIn: "Inloggen met Google",
    signingIn: "Inloggen...",
    secureCloud: "Beveiligde Cloudverwerking",
    activeDatabase: "STT Database",
    signOut: "Uitloggen",
    createNewSummary: "Nieuwe samenvatting maken",
    searchPlaceholder: "Zoek opnamen...",
    activeConversations: "Actieve gesprekken",
    archivedFolders: "Gearchiveerde mappen",
    refresh: "Vernieuwen",
    loadingSpreadsheet: "Spreadsheetgegevens laden...",
    noMatches: "Geen resultaten gevonden",
    noMatchesSub: "Probeer uw zoekcriteria aan te passen.",
    noSummaries: "Nog geen samenvattingen",
    noSummariesSub: 'Tik op "Nieuwe samenvatting maken" om uw eerste dicteeropname te starten!',
    archiveEmpty: "Archief is leeg",
    archiveEmptySub: "Samenvattingen die u archiveert verschijnen hier.",
    archiveConfirm: (title: string) => `Weet u zeker dat u "${title}" wilt archiveren?`,
    deleteConfirm: (title: string) => `Wilt u "${title}" verwijderen uit uw mobiele weergave? (De originele gegevens blijven veilig in Google Sheets)`,
    recordingsTab: "Opnamen",
    archiveTab: "Archief",
    recordingActive: "Gesprek opnemen",
    recordingPaused: "Opname gepauzeerd",
    speakInstruction: "Begin met spreken om tekst te dicteren...",
    typeInstruction: "U kunt hieronder ook handmatig tekst typen of plakken.",
    manualLabel: "Tekst handmatig bewerken/plakken (optioneel)",
    manualPlaceholder: "Typ of bewerk uw gedicteerde tekst hier...",
    summarizing: "Gemini vat samen...",
    saveAndEmail: "Opslaan & E-mail samenvatting",
    convoDetails: "Gespreksdetails",
    emailConfirmHeader: "E-mailbevestigingsstatus",
    recipient: "Ontvanger",
    subjectLine: "Onderwerpregel",
    aiSummary: "Gestructureerde AI-samenvatting",
    originalSpeech: "Originele spraaktranscriptie",
    closeSummary: "Samenvatting sluiten",
    archiveRecording: "Opname archiveren",
    welcome: (name: string) => `Welkom, ${name}!`,
    databaseError: "Fout bij configureren van Google Sheet database",
    fetchError: "Laden van opnamen uit Google Sheet mislukt",
    signedOut: "Succesvol uitgelogd",
    micNotSupported: "Web Speech API wordt niet ondersteund in deze browser. Typ alstublieft handmatig in het tekstvak.",
    micDenied: "Microfoontoestemming geweigerd. Verleen toestemming of typ handmatig tekst.",
    savedSuccess: "Samenvatting succesvol opgeslagen in Google Sheets en gemaild!",
    updateSuccess: "Samenvatting succesvol bijgewerkt in Google Sheets en gemaild!",
    transcriptionEmpty: "De transcriptie is leeg. Spreek of voer handmatig tekst in voordat u opslaat.",
    dbNotReady: "Database of autorisatie is niet volledig geïnitialiseerd. Wacht even en probeer het opnieuw.",
    initializingDb: "Database initialiseren in Google Drive...",
    confirmSignOut: "Weet u zeker dat u wilt uitloggen?",
    reopenAndRecord: "Opnieuw openen & opnemen",
    updateRecording: "Aanpassing opslaan & E-mailen",
    updating: "Gemini bijwerken...",
  }
};

export default function App() {
  // App language state
  const [appLang, setAppLang] = useState<'en' | 'nl'>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved === 'en' || saved === 'nl') {
      return saved;
    }
    return navigator.language.startsWith('nl') ? 'nl' : 'en';
  });

  const t = translations[appLang];

  const changeLanguage = (lang: 'en' | 'nl') => {
    setAppLang(lang);
    localStorage.setItem('app_language', lang);
  };

  // Auth state
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Database / Sheets config state
  const [isSettingUpDb, setIsSettingUpDb] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);

  // App UI State
  const [activeTab, setActiveTab] = useState<'recordings' | 'archive'>('recordings');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Deleted items track (only stored in local storage per user's requests)
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // Detailed Modal view state
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  // Recording Modal state
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false); // Whether dictation is "on" (dictating/recording)
  const [fullText, setFullText] = useState(''); // Text accumulated so far
  const [interimText, setInterimText] = useState(''); // Text currently being dictated
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [updatingRecording, setUpdatingRecording] = useState<Recording | null>(null);

  // Status & Notifications state
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Speech Recognition ref
  const recognitionRef = useRef<any>(null);

  // Load deleted IDs from localStorage on startup
  useEffect(() => {
    const savedDeleted = localStorage.getItem('deleted_recording_ids');
    if (savedDeleted) {
      try {
        setDeletedIds(JSON.parse(savedDeleted));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        // Automatically set up or retrieve the database sheet
        setupDatabase(accessToken);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Show status notification temporarily
  const showStatus = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  // Set up Google Drive Folder and Google Sheet Database
  const setupDatabase = async (accessToken: string) => {
    setIsSettingUpDb(true);
    try {
      const res = await fetch('/api/setup-db', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to setup database');
      }
      const data = await res.json();
      setSpreadsheetId(data.spreadsheetId);
      setSheetName(data.sheetName);
      
      // Load previous recordings
      fetchRecordings(accessToken, data.spreadsheetId, data.sheetName);
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || t.databaseError, 'error');
    } finally {
      setIsSettingUpDb(false);
    }
  };

  // Fetch recordings from Sheets
  const fetchRecordings = async (authToken: string, sheetId: string, name: string) => {
    setIsLoadingRecordings(true);
    try {
      const res = await fetch('/api/recordings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ spreadsheetId: sheetId, sheetName: name })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch recordings');
      }
      const data = await res.json();
      setRecordings(data.recordings || []);
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || t.fetchError, 'error');
    } finally {
      setIsLoadingRecordings(false);
    }
  };

  // Handle Google Login
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        showStatus(t.welcome(result.user.displayName || 'User'));
        await setupDatabase(result.accessToken);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setErrorMsg(err.message || 'Google Authentication failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (window.confirm(t.confirmSignOut)) {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setRecordings([]);
      setSpreadsheetId(null);
      setSheetName(null);
      showStatus(t.signedOut, 'info');
    }
  };

  // Speech-to-Text Speech Recognition Management
  useEffect(() => {
    if (!isRecordingActive) {
      return;
    }

    if (!SpeechRecognitionAPI) {
      showStatus(t.micNotSupported, 'info');
      return;
    }

    // Initialize speech recognition
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = appLang === 'nl' ? 'nl-NL' : 'en-US'; // Dynamically match dictation language

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) {
        setFullText(prev => prev + final);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        showStatus(t.micDenied, 'error');
        setIsRecordingActive(false);
      }
    };

    let isComponentActive = true;

    recognition.onend = () => {
      if (isComponentActive) {
        // Safe delayed restart for continuous recording upon natural timeouts
        setTimeout(() => {
          try {
            if (isComponentActive) {
              recognition.start();
            }
          } catch (e) {
            console.error('Restart error:', e);
          }
        }, 200);
      }
    };

    recognitionRef.current = recognition;

    // Small delay before starting a new recognition session to let previous locks completely release
    const startTimer = setTimeout(() => {
      try {
        if (isComponentActive) {
          recognition.start();
        }
      } catch (e) {
        console.error('Start error:', e);
      }
    }, 250);

    return () => {
      isComponentActive = false;
      clearTimeout(startTimer);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      try {
        recognition.onend = null; // Detach event before stopping to prevent loop
        recognition.stop();
      } catch (e) {
        console.error('Stop error during cleanup:', e);
      }
    };
  }, [isRecordingActive, appLang]);

  // Toggle dictation
  const handleToggleRecording = () => {
    if (isRecordingActive) {
      // If pausing, merge any existing interim/unfinalized text safely
      if (interimText.trim()) {
        setFullText(prev => (prev + ' ' + interimText).trim() + ' ');
        setInterimText('');
      }
    }
    setIsRecordingActive(!isRecordingActive);
  };

  // Open Recording modal
  const openNewSummaryModal = () => {
    setUpdatingRecording(null);
    setFullText('');
    setInterimText('');
    setIsRecordingActive(true);
    setIsRecordingModalOpen(true);
  };

  // Re-open an existing active recording to edit/add info
  const handleReopenRecording = (recording: Recording) => {
    setUpdatingRecording(recording);
    setFullText(recording.fullText);
    setInterimText('');
    setIsRecordingActive(false); // Initially paused so they can review, then record
    setIsRecordingModalOpen(true);
  };

  // Save the full transcribed recording, summarize it with Gemini and email
  const handleSaveRecording = async () => {
    // Combine full text and any pending interim text
    const finalCompiledText = (fullText + ' ' + interimText).trim();
    if (!finalCompiledText) {
      alert(t.transcriptionEmpty);
      return;
    }

    if (!token || !spreadsheetId || !sheetName) {
      alert(t.dbNotReady);
      return;
    }

    setIsRecordingActive(false);
    setIsSavingRecord(true);
    try {
      const endpoint = updatingRecording ? '/api/recordings/update' : '/api/recordings/create';
      const bodyPayload = updatingRecording 
        ? { spreadsheetId, sheetName, id: updatingRecording.id, fullText: finalCompiledText, language: appLang }
        : { spreadsheetId, sheetName, fullText: finalCompiledText, language: appLang };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server processing failed');
      }

      const data = await res.json();
      showStatus(updatingRecording ? t.updateSuccess : t.savedSuccess, 'success');
      
      if (updatingRecording) {
        // Update recording in the list
        setRecordings(prev => prev.map(rec => rec.id === updatingRecording.id ? data.recording : rec));
      } else {
        // Prepend to local recording list so it shows immediately
        setRecordings(prev => [data.recording, ...prev]);
      }
      
      // Close modal
      setIsRecordingModalOpen(false);
      setUpdatingRecording(null);
    } catch (err: any) {
      console.error(err);
      alert(`Error processing summary: ${err.message || 'Please check server environment variables.'}`);
    } finally {
      setIsSavingRecord(false);
    }
  };

  // Archive a recording in Google Sheets
  const handleArchiveRecording = async (e: React.MouseEvent, recording: Recording) => {
    e.stopPropagation(); // Avoid opening the details modal
    if (!token || !spreadsheetId || !sheetName) return;

    if (!window.confirm(t.archiveConfirm(recording.shortTitle))) {
      return;
    }

    try {
      const res = await fetch('/api/recordings/archive', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spreadsheetId,
          sheetName,
          id: recording.id
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to archive item');
      }

      showStatus(appLang === 'nl' ? `"${recording.shortTitle}" is gearchiveerd!` : `"${recording.shortTitle}" has been archived!`);
      // Update local recording status
      setRecordings(prev => prev.map(rec => rec.id === recording.id ? { ...rec, status: 'Archived' } : rec));
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || 'Error archiving recording', 'error');
    }
  };

  // Delete an archived summary ONLY from local app state/view (Google Sheet remains untouched)
  const handleDeleteArchived = (e: React.MouseEvent, recordingId: string, title: string) => {
    e.stopPropagation(); // Avoid opening the details modal
    if (!window.confirm(t.deleteConfirm(title))) {
      return;
    }

    const updatedDeleted = [...deletedIds, recordingId];
    setDeletedIds(updatedDeleted);
    localStorage.setItem('deleted_recording_ids', JSON.stringify(updatedDeleted));
    showStatus(appLang === 'nl' ? 'Verwijderd uit archiefweergave' : 'Removed from archive view', 'success');
  };

  // Filter and compute active vs archived items (excluding locally deleted IDs)
  const visibleRecordings = recordings.filter(rec => !deletedIds.includes(rec.id));
  
  const activeRecordings = visibleRecordings.filter(rec => rec.status === 'Active');
  const archivedRecordings = visibleRecordings.filter(rec => rec.status === 'Archived');

  const filteredRecordings = (activeTab === 'recordings' ? activeRecordings : archivedRecordings).filter(rec => {
    const query = searchQuery.toLowerCase();
    return (
      rec.shortTitle.toLowerCase().includes(query) ||
      rec.description.toLowerCase().includes(query) ||
      rec.emailSubject.toLowerCase().includes(query) ||
      rec.fullText.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-start antialiased selection:bg-emerald-100 font-sans">
      
      {/* Status toast notifications */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium border ${
              statusMessage.type === 'error' 
                ? 'bg-rose-50 text-rose-800 border-rose-100' 
                : statusMessage.type === 'info'
                ? 'bg-blue-50 text-blue-800 border-blue-100'
                : 'bg-emerald-50 text-emerald-800 border-emerald-100'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOGIN VIEW */}
      {needsAuth ? (
        <div className="w-full max-w-md min-h-screen flex flex-col justify-between px-6 py-12 bg-white shadow-2xl relative overflow-hidden">
          {/* Ambient header glow */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-emerald-50/50 to-transparent pointer-events-none" />
          
          {/* Language Selector Pill in Login page */}
          <div className="absolute top-4 right-4 z-20 flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
            <button
              onClick={() => changeLanguage('en')}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                appLang === 'en' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage('nl')}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                appLang === 'nl' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              NL
            </button>
          </div>

          <div className="flex flex-col items-center text-center pt-8 z-10">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/10 mb-6">
              <Mic className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {t.title}
            </h1>
            <p className="mt-2.5 text-slate-500 text-sm max-w-xs leading-relaxed">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-col items-center w-full z-10 my-8">
            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google Sign In Button */}
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full py-3.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{isLoggingIn ? t.signingIn : t.signIn}</span>
            </button>
            
            <p className="mt-4 text-xs text-slate-400 text-center max-w-[280px]">
              {t.permissionWarning}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-6 text-center z-10">
            <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
              {t.secureCloud}
            </span>
          </div>
        </div>
      ) : (
        /* MAIN APPLICATION VIEW - Optimized for mobile width */
        <div className="w-full max-w-md min-h-screen bg-slate-50 flex flex-col shadow-xl">
          
          {/* Header */}
          <header className="bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'Profile'} 
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full ring-2 ring-emerald-500/20 object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  {user?.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-900 text-sm leading-tight truncate max-w-[130px]">
                  {user?.displayName || 'My Account'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Database className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                  {t.activeDatabase}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Selector Pill */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 mr-1">
                <button
                  onClick={() => changeLanguage('en')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                    appLang === 'en' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => changeLanguage('nl')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                    appLang === 'nl' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  NL
                </button>
              </div>

              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                title={t.signOut}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Sheet database configuring banner */}
          {isSettingUpDb && (
            <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
              <span>{t.initializingDb}</span>
            </div>
          )}

          {/* Main List and Controls */}
          <main className="flex-1 px-5 py-6 flex flex-col overflow-y-auto pb-24">
            
            {/* Quick Action: Create New Summary */}
            <div className="mb-6">
              <button 
                onClick={openNewSummaryModal}
                disabled={isSettingUpDb}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-semibold shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/15 transition-all duration-200 flex items-center justify-center gap-2.5 text-sm"
              >
                <Plus className="w-4 h-4 text-white" />
                <Mic className="w-4 h-4 text-white" />
                <span>{t.createNewSummary}</span>
              </button>
            </div>

            {/* Search filter bar */}
            <div className="relative mb-6">
              <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-3.5" />
              <input 
                type="text" 
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:outline-none rounded-xl text-sm placeholder:text-slate-400 text-slate-800 transition-colors shadow-sm"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Header of dynamic list */}
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {activeTab === 'recordings' ? t.activeConversations : t.archivedFolders} ({filteredRecordings.length})
              </h2>
              {recordings.length > 0 && !isLoadingRecordings && (
                <button 
                  onClick={() => setupDatabase(token!)}
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded"
                >
                  {t.refresh}
                </button>
              )}
            </div>

            {/* Recordings List */}
            <div className="flex-1 flex flex-col gap-3">
              {isLoadingRecordings ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                  <span className="text-xs font-medium text-slate-500">{t.loadingSpreadsheet}</span>
                </div>
              ) : filteredRecordings.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center flex flex-col items-center justify-center shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                    {activeTab === 'recordings' ? (
                      <FileText className="w-6 h-6 text-slate-400" />
                    ) : (
                      <Archive className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">
                    {searchQuery ? t.noMatches : activeTab === 'recordings' ? t.noSummaries : t.archiveEmpty}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                    {searchQuery 
                      ? t.noMatchesSub 
                      : activeTab === 'recordings' 
                      ? t.noSummariesSub 
                      : t.archiveEmptySub}
                  </p>
                </div>
              ) : (
                filteredRecordings.map((recording) => (
                  <motion.div
                    key={recording.id}
                    layoutId={`card-${recording.id}`}
                    onClick={() => setSelectedRecording(recording)}
                    className="bg-white hover:bg-slate-50/50 border border-slate-100 hover:border-slate-200 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-sm flex flex-col gap-3 relative group"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {recording.date}
                          </span>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">ID: {recording.id}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">
                          {recording.shortTitle}
                        </h3>
                      </div>

                      {/* Action buttons with custom mobile size */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {activeTab === 'recordings' ? (
                          <>
                            <button
                              onClick={() => handleReopenRecording(recording)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                              title={t.reopenAndRecord}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleArchiveRecording(e, recording)}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
                              title={appLang === 'nl' ? 'Archiveren' : 'Archive'}
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => handleDeleteArchived(e, recording.id, recording.shortTitle)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                            title={appLang === 'nl' ? 'Verwijderen' : 'Remove'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {recording.description}
                    </p>

                    <div className="border-t border-slate-100/80 pt-2.5 flex items-center justify-between mt-0.5 text-[10px] font-medium text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate pr-2">{appLang === 'nl' ? 'Onderwerp' : 'Subject'}: {recording.emailSubject}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </main>

          {/* BOTTOM NAVIGATION BAR */}
          <nav className="bg-white border-t border-slate-100 flex items-center justify-around py-3 px-6 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30">
            <button
              onClick={() => { setActiveTab('recordings'); setSearchQuery(''); }}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all duration-200 ${
                activeTab === 'recordings' ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="text-[10px]">{appLang === 'nl' ? 'Opnamen' : 'Recordings'}</span>
            </button>

            <button
              onClick={() => { setActiveTab('archive'); setSearchQuery(''); }}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all duration-200 ${
                activeTab === 'archive' ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Archive className="w-5 h-5" />
              <span className="text-[10px]">{appLang === 'nl' ? 'Archief' : 'Archive'}</span>
            </button>
          </nav>

          {/* RECORDING / DICTATION MODAL */}
          <AnimatePresence>
            {isRecordingModalOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end justify-center z-50 p-4"
              >
                <motion.div 
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className="bg-white w-full max-w-md rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
                >
                  {/* Modal Header */}
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${isRecordingActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                      <span className="font-bold text-slate-900 text-sm">
                        {isRecordingActive ? t.recordingActive : t.recordingPaused}
                      </span>
                    </div>
                    <button 
                      onClick={() => {
                        setIsRecordingActive(false);
                        setIsRecordingModalOpen(false);
                      }}
                      disabled={isSavingRecord}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors disabled:opacity-30"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Dictation Box */}
                  <div className="flex-1 p-5 overflow-y-auto min-h-[180px] max-h-[300px] bg-slate-50/50 flex flex-col">
                    <div className="flex-1 flex flex-col justify-start">
                      {fullText || interimText ? (
                        <div className="text-slate-800 text-sm leading-relaxed space-y-2 whitespace-pre-wrap font-medium">
                          <span>{fullText}</span>
                          {interimText && (
                            <span className="text-emerald-600 bg-emerald-50 px-1 rounded transition-colors border-b border-emerald-300">
                              {interimText}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-slate-400">
                          <Mic className="w-8 h-8 text-slate-300 mb-2.5 animate-bounce" />
                          <p className="text-xs font-semibold">{t.speakInstruction}</p>
                          <p className="text-[10px] text-slate-400 max-w-[200px] mt-1 leading-normal">
                            {t.typeInstruction}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Typing fallback input block (helps with testing & iframe restrictions) */}
                  <div className="px-5 py-3 border-t border-slate-100 bg-white">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {t.manualLabel}
                    </label>
                    <textarea
                      value={fullText}
                      onChange={(e) => setFullText(e.target.value)}
                      placeholder={t.manualPlaceholder}
                      className="w-full h-16 p-2 text-xs border border-slate-200 focus:border-emerald-500 rounded-lg focus:outline-none resize-none"
                    />
                  </div>

                  {/* Recording control panel */}
                  <div className="p-5 border-t border-slate-100 bg-slate-50/20 flex flex-col items-center gap-4">
                    {/* Pulsing soundwave visualization when speaking */}
                    {isRecordingActive && (
                      <div className="flex items-center gap-1.5 h-6">
                        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ height: [4, 16, 4] }}
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                              delay: i * 0.1,
                            }}
                            className="w-1 bg-emerald-500 rounded-full"
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-4 w-full">
                      {/* Play/Pause Record Button - Perfect size optimized for mobile tap */}
                      <button
                        onClick={handleToggleRecording}
                        disabled={isSavingRecord}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isRecordingActive 
                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/10' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/10'
                        }`}
                        title={isRecordingActive ? (appLang === 'nl' ? 'Dicteren pauzeren' : 'Pause Dictation') : (appLang === 'nl' ? 'Hervatten' : 'Resume Dictation')}
                      >
                        {isRecordingActive ? (
                          <Pause className="w-5 h-5 text-white fill-current" />
                        ) : (
                          <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                        )}
                      </button>

                      {/* Save summaries to Sheets & Gmail button */}
                      <button
                        onClick={handleSaveRecording}
                        disabled={isSavingRecord || (!fullText.trim() && !interimText.trim())}
                        className="flex-1 py-3 px-5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl font-semibold shadow-md transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:shadow-none"
                      >
                        {isSavingRecord ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            <span>{updatingRecording ? t.updating : t.summarizing}</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>{updatingRecording ? t.updateRecording : t.saveAndEmail}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DETAILED SUMMARY VIEW MODAL */}
          <AnimatePresence>
            {selectedRecording && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end justify-center z-50 p-4"
              >
                <motion.div 
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className="bg-white w-full max-w-md rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
                >
                  {/* Detailed Modal Header */}
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {t.convoDetails}
                      </span>
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {selectedRecording.date}
                      </span>
                    </div>
                    <button 
                      onClick={() => setSelectedRecording(null)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Summary Contents */}
                  <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
                    {/* Header Details */}
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                        {selectedRecording.shortTitle}
                      </h2>
                      <p className="text-xs text-slate-500 italic mt-1.5 leading-relaxed bg-slate-50 border-l-2 border-emerald-400 pl-3 py-1">
                        {selectedRecording.description}
                      </p>
                    </div>

                    {/* Email delivery details */}
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Mail className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t.emailConfirmHeader}</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        <span className="text-slate-400">{t.recipient}: </span>
                        ikbennietchristophe@gmail.com
                      </div>
                      <div className="text-xs text-slate-600 font-medium truncate">
                        <span className="text-slate-400">{t.subjectLine}: </span>
                        {selectedRecording.emailSubject}
                      </div>
                    </div>

                    {/* AI Structured Summary */}
                    <div>
                      <h3 className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-widest block mb-2.5">
                        {t.aiSummary}
                      </h3>
                      <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed text-sm bg-emerald-50/20 border border-emerald-100/50 p-4 rounded-2xl">
                        <ReactMarkdown>{selectedRecording.structuredSummary}</ReactMarkdown>
                      </div>
                    </div>

                    {/* Original Transcription */}
                    <div>
                      <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
                        {t.originalSpeech}
                      </h3>
                      <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl max-h-40 overflow-y-auto text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {selectedRecording.fullText}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar inside detailed summary */}
                  <div className="p-5 border-t border-slate-100 bg-slate-50/30 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedRecording(null)}
                        className="flex-1 py-2.5 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-xs font-semibold transition-colors"
                      >
                        {t.closeSummary}
                      </button>
                      {selectedRecording.status === 'Active' && (
                        <button 
                          onClick={() => {
                            handleReopenRecording(selectedRecording);
                            setSelectedRecording(null);
                          }}
                          className="flex-1 py-2.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{t.reopenAndRecord}</span>
                        </button>
                      )}
                    </div>
                    {selectedRecording.status === 'Active' && (
                      <button 
                        onClick={(e) => {
                          handleArchiveRecording(e, selectedRecording);
                          setSelectedRecording(null);
                        }}
                        className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{t.archiveRecording}</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}
    </div>
  );
}
