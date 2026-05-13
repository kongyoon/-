import React, { useState, useRef, useEffect, useMemo } from "react";
import { Mic, Square, Loader2, Send, Moon, MessageSquare, BookOpen, Tags, Smile, Search, Calendar, ChevronRight, Hash, ArrowLeft, BarChart3, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { processDreamAudio, generateDreamImage, createDreamChat, DreamAnalysis, analyzeMoodCorrelations } from "./lib/gemini";
import { DreamEntry, saveDream, getDreams, deleteDream } from "./lib/store";

type AppState = "idle" | "recording" | "processing" | "result" | "archive";

const MOODS = ["기쁨", "평온함", "불안함", "슬픔", "경이로움", "혼란스러움", "두려움", "지적 호기심", "분노", "무기력"];

// Simple unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [currentEntry, setCurrentEntry] = useState<DreamEntry | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [entries, setEntries] = useState<DreamEntry[]>([]);
  const [correlationText, setCorrelationText] = useState("");
  const [isAnalyzingMood, setIsAnalyzingMood] = useState(false);
  const [searchTag, setSearchTag] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    const list = await getDreams();
    setEntries(list);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.start();
      setAppState("recording");
      setErrorMsg("");
    } catch (err) {
      console.error(err);
      setErrorMsg("마이크 접근 권한이 필요합니다.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    setAppState("processing");
    setProcessingStatus("무의식의 조각들을 수집하는 중...");

    mediaRecorderRef.current.onstop = async () => {
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const reader = new FileReader();

      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          
          setProcessingStatus("융의 시선으로 원형을 분석하는 중...");
          const result = await processDreamAudio(base64data, mimeType);
          
          setProcessingStatus("꿈의 심상을 캔버스에 그리는 중...");
          const img = await generateDreamImage(result.imagePrompt);
          
          const newEntry: DreamEntry = {
            id: generateId(),
            timestamp: Date.now(),
            analysis: result,
            imageUrl: img,
            mood: null,
            tags: []
          };
          
          await saveDream(newEntry);
          setCurrentEntry(newEntry);
          await loadEntries();
          
          setAppState("result");
        } catch (err) {
          console.error(err);
          setErrorMsg("해석 중 오류가 발생했습니다. 다시 시도해 주세요.");
          setTimeout(() => {
            setAppState("idle");
            setErrorMsg("");
          }, 4000);
        }
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
  };

  const restart = () => {
    setAppState("idle");
    setCurrentEntry(null);
  };

  const handleUpdateEntry = async (updates: Partial<DreamEntry>) => {
    if (!currentEntry) return;
    const updated = { ...currentEntry, ...updates };
    setCurrentEntry(updated);
    await saveDream(updated);
    await loadEntries();
  };

  const viewArchive = () => setAppState("archive");

  const analyzeCorrelations = async () => {
    if (entries.length === 0) return;
    setIsAnalyzingMood(true);
    try {
      const result = await analyzeMoodCorrelations(entries);
      setCorrelationText(result);
    } catch (e) {
      setCorrelationText("분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzingMood(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchTag.trim()) return entries;
    const kw = searchTag.toLowerCase();
    return entries.filter(e => e.tags.some(t => t.toLowerCase().includes(kw)));
  }, [entries, searchTag]);

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[#020617] text-slate-200 font-sans">
      
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 bg-slate-950/50 border-b border-slate-800 shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
          <h1 className="text-xl font-bold tracking-tight text-white cursor-pointer" onClick={restart}>
            루시드 노트 <span className="text-indigo-400 font-light text-sm ml-2 hidden sm:inline">Dreamscape</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {appState === "archive" ? (
             <button 
               onClick={restart}
               className="px-4 py-2 text-sm font-medium rounded-full border border-slate-700 hover:bg-slate-800 transition-colors flex items-center gap-2"
             >
               <Mic className="w-4 h-4" /> 새로 기록
             </button>
          ) : (
            <>
              {appState === "result" && (
                <button 
                  onClick={restart}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  새 기록
                </button>
              )}
              <button 
                onClick={viewArchive}
                className="px-4 py-2 text-sm font-medium rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" /> 보관함
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {(appState === "idle" || appState === "recording") && (
            <motion.div
              key="record-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-white leading-tight">
                방금 깬 꿈의 조각을<br/>들려주세요
              </h2>
              <p className="text-slate-400 text-lg mb-16 max-w-lg">
                무의식의 바다에서 건져올린 기억이 희미해지기 전에 기록하세요. 의식의 언어로 해석해 드립니다.
              </p>

              <button
                onClick={appState === "idle" ? startRecording : stopRecording}
                className={`group flex items-center justify-center w-28 h-28 rounded-full transition-all duration-500 hover:scale-105 active:scale-95 ${
                  appState === "recording" 
                    ? "bg-red-500/20 border border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.4)] animate-pulse" 
                    : "bg-indigo-500/20 border border-indigo-500/50 shadow-[0_0_40px_rgba(99,102,241,0.3)]"
                }`}
              >
                {appState === "idle" ? (
                  <Mic className="w-10 h-10 md:w-12 md:h-12 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                ) : (
                  <Square className="w-8 h-8 md:w-10 md:h-10 text-red-500 fill-red-500" />
                )}
              </button>
              
              <div className="mt-8 h-6">
                {appState === "recording" ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-400 font-medium tracking-widest text-sm uppercase"
                  >
                    Recording... 녹음 중지하려면 탭하세요
                  </motion.p>
                ) : (
                  <p className="text-slate-500 text-sm tracking-widest uppercase">Tap to Record</p>
                )}
                {errorMsg && (
                  <p className="text-red-400 mt-4 font-light">{errorMsg}</p>
                )}
              </div>
            </motion.div>
          )}

          {appState === "processing" && (
            <motion.div
              key="processing-view"
              initial={{ opacity: 0, filter: "blur(20px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="relative">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin opacity-50" />
                <Moon className="w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
              </div>
              <motion.p
                key={processingStatus}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 text-xl font-medium text-slate-300 tracking-wide text-center"
              >
                {processingStatus}
              </motion.p>
            </motion.div>
          )}

          {appState === "result" && currentEntry && (
            <motion.div
              key="result-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
              className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 w-full xl:max-w-[1400px] mx-auto overflow-hidden"
            >
              {/* Left Panel: Record & Transcribe & Mood & Tags */}
              <section className="w-full lg:w-3/12 flex flex-col gap-4 overflow-y-auto pr-1">
                <div className="bg-slate-900/40 rounded-3xl border border-slate-800 p-6 flex flex-col shrink-0 max-h-[50vh] overflow-hidden">
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">음성 기록</h3>
                    <div className="flex gap-1">
                      <div className="w-1 h-3 bg-indigo-500 animate-pulse"></div>
                      <div className="w-1 h-5 bg-indigo-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1 h-2 bg-indigo-600 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-sm leading-relaxed text-slate-300">
                      "{currentEntry.analysis.transcription}"
                    </div>
                  </div>
                </div>

                {/* Mood & Tags Section */}
                <div className="bg-slate-900/40 rounded-3xl border border-slate-800 p-6 flex flex-col gap-5 shrink-0">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
                       <Smile className="w-4 h-4"/> 깨어났을 때의 기분
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {Array.from(new Set([...MOODS, ...(currentEntry.mood && !MOODS.includes(currentEntry.mood) ? [currentEntry.mood] : [])])).map(m => (
                        <button 
                          key={m}
                          onClick={() => handleUpdateEntry({ mood: m })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            currentEntry.mood === m 
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]' 
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const input = form.elements.namedItem('moodInput') as HTMLInputElement;
                      const val = input.value.trim();
                      if (val) {
                        handleUpdateEntry({ mood: val });
                      }
                      input.value = '';
                    }}>
                      <input 
                        type="text" 
                        name="moodInput"
                        placeholder="직접 입력..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </form>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
                       <Tags className="w-4 h-4"/> 태그
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {currentEntry.tags.map(t => (
                        <span key={t} className="px-3 py-1 bg-purple-900/30 text-purple-300 rounded-full text-xs border border-purple-800 flex items-center gap-1">
                          <Hash className="w-3 h-3"/> {t}
                          <button onClick={() => handleUpdateEntry({ tags: currentEntry.tags.filter(tag => tag !== t) })} className="ml-1 hover:text-white">×</button>
                        </span>
                      ))}
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const input = form.elements.namedItem('tag') as HTMLInputElement;
                      const val = input.value.trim();
                      if (val && !currentEntry.tags.includes(val)) {
                        handleUpdateEntry({ tags: [...currentEntry.tags, val] });
                      }
                      input.value = '';
                    }}>
                      <input 
                        type="text" 
                        name="tag"
                        placeholder="새 태그 입력 + Enter" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </form>
                  </div>
                </div>

              </section>

              {/* Middle Panel: AI Surrealist Image */}
              <section className="flex-1 flex flex-col bg-slate-900/40 rounded-3xl border border-slate-800 p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80 z-10 pointer-events-none"></div>
                <div className="flex-1 rounded-2xl overflow-hidden relative border border-white/5 bg-black flex items-center justify-center">
                  {currentEntry.imageUrl ? (
                    <img 
                      src={currentEntry.imageUrl} 
                      alt="Dream imagery" 
                      className="w-full h-full object-cover opacity-80 mix-blend-screen"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin mb-4" />
                      <span className="text-sm">시각적 심상 구현 중...</span>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-8 left-8 right-8 z-20 pointer-events-none">
                  <h2 className="text-2xl font-serif italic text-white mb-2 leading-relaxed">
                     "{currentEntry.analysis.summary.split('.')[0] || "무의식의 파편"}"
                  </h2>
                  <p className="text-sm text-slate-300 max-w-md pointer-events-auto overflow-y-auto max-h-32 pr-2">
                    {currentEntry.analysis.summary}
                  </p>
                </div>
              </section>

              {/* Right Panel: Interpretation & Chat */}
              <section className="w-full lg:w-[320px] xl:w-[380px] flex flex-col gap-4">
                {/* Psychological Interpretation */}
                <div className="flex-1 bg-slate-900/40 rounded-3xl border border-slate-800 p-6 flex flex-col overflow-hidden">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4 shrink-0">심리학적 분석 (융의 원형)</h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {currentEntry.analysis.symbols.map((item, i) => (
                      <div key={i} className="space-y-2 pb-2">
                        <p className="text-xs font-bold text-indigo-300 tracking-wide">[{item.symbol}]</p>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {item.meaning}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chat Interface */}
                <div className="h-80 lg:h-72 bg-slate-950 rounded-3xl border border-slate-800 flex flex-col overflow-hidden relative shrink-0">
                  <ChatInterface analysis={currentEntry.analysis} />
                </div>
              </section>
            </motion.div>
          )}
          {appState === "archive" && (
            <motion.div
              key="archive-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col w-full max-w-5xl mx-auto p-4 overflow-hidden gap-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 mt-4">
                <h2 className="text-3xl font-bold text-white tracking-tight">꿈의 기록 보관함</h2>
                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={searchTag}
                    onChange={(e) => setSearchTag(e.target.value)}
                    placeholder="태그로 검색..."
                    className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-full py-2 pl-9 pr-4 text-sm text-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* Insights Panel */}
              <div className="shrink-0 bg-slate-900/60 border border-indigo-500/30 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <h3 className="text-lg font-bold text-indigo-300 flex items-center gap-2 mb-2">
                       <BarChart3 className="w-5 h-5"/> 꿈-감정 상관관계 분석
                    </h3>
                    <p className="text-sm text-slate-400 mb-4 max-w-xl">
                      최근 기록된 꿈과 깨어났을 때의 기분 데이터를 바탕으로 무의식적 패턴과 감정의 연관성을 도출합니다.
                    </p>
                  </div>
                  <button 
                    onClick={analyzeCorrelations}
                    disabled={isAnalyzingMood || entries.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isAnalyzingMood ? <Loader2 className="w-4 h-4 animate-spin"/> : "인사이트 생성"}
                  </button>
                </div>
                {correlationText && (
                  <div className="mt-4 p-4 bg-slate-950/50 rounded-xl border border-indigo-500/20 max-h-48 overflow-y-auto markdown-body text-sm text-slate-300">
                    <Markdown>{correlationText}</Markdown>
                  </div>
                )}
              </div>

              {/* Entries Grid */}
              <div className="flex-1 overflow-y-auto pr-2 pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
                {filteredEntries.map(entry => (
                  <div 
                    key={entry.id} 
                    className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden hover:border-slate-600 transition-colors cursor-pointer group flex flex-col"
                    onClick={() => {
                      setCurrentEntry(entry);
                      setAppState("result");
                    }}
                  >
                    <div className="h-32 bg-black relative overflow-hidden border-b border-white/5">
                       <img src={entry.imageUrl} alt="dream" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                       <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                          {entry.mood && (
                            <span className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-md rounded border border-slate-700 text-[10px] text-slate-300">
                              기분: {entry.mood}
                            </span>
                          )}
                       </div>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="text-xs text-slate-500 mb-2 flex justify-between items-center">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(entry.timestamp).toLocaleDateString()}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteDream(entry.id).then(loadEntries); }}
                          className="text-slate-600 hover:text-red-400"
                        >
                           <Trash2 className="w-3 h-3"/>
                        </button>
                      </div>
                      <p className="text-sm text-slate-300 line-clamp-3 mb-3 flex-1 leading-relaxed">
                        {entry.analysis.summary}
                      </p>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-auto">
                          {entry.tags.map(t => (
                             <span key={t} className="text-[10px] text-purple-400">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredEntries.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-500">
                    <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                    <p>기록된 꿈이 없습니다.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ChatInterface({ analysis }: { analysis: DreamAnalysis }) {
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current = createDreamChat(analysis);
    setMessages([{ 
      role: 'model', 
      text: '당신의 꿈이 전하는 무의식의 메시지가 흥미롭습니다. 특정 상징에 대해 더 깊이 알고 싶은 부분이 있나요?' 
    }]);
  }, [analysis]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !chatRef.current || isTyping) return;
    
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const responseStream = await chatRef.current.sendMessageStream({ message: userMsg });
      let fullText = "";
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      for await (const chunk of responseStream) {
        fullText += (chunk as any).text;
        setMessages(prev => {
          const newMsg = [...prev];
          newMsg[newMsg.length - 1].text = fullText;
          return newMsg;
        });
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: '지금은 무의식과 연결하기 어렵습니다. 다시 시도해 주세요.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <div className="p-3 bg-slate-900/80 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-tighter shrink-0 z-10 flex items-center gap-2">
        <MessageSquare className="w-3 h-3" /> 심볼 분석 챗봇
      </div>
      
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[85%] leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50'
              }`}
            >
              {msg.role === 'model' ? (
                <div className="markdown-body">
                  <Markdown>{msg.text}</Markdown>
                </div>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700/50 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950/80">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isTyping}
            placeholder="질문을 입력하세요..."
            className="w-full bg-slate-900 border border-slate-700 rounded-full py-2.5 pl-4 pr-10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button 
            type="submit" 
            disabled={isTyping || !input.trim()}
            className="absolute right-1.5 top-1.5 w-7 h-7 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </>
  );
}
