import { useState, useEffect, useRef } from "react";
import { Mic, Headphones, Radio, MicOff, Volume2, VolumeX, Terminal, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [role, setRole] = useState<"broadcaster" | "listener" | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<string[]>(["System initialized."]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    addLog(`Attempting to connect to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => addLog("Connected to signaling server.");
    ws.onclose = () => addLog("Disconnected from server.");
    ws.onerror = (event) => {
      console.error("WebSocket error event:", event);
      addLog(`WebSocket error occurred (ReadyState: ${ws.readyState}). Check console for details.`);
    };
    
    ws.onmessage = async (event) => {
      if (role === "listener" && isStreaming) {
        if (event.data instanceof Blob) {
          const buffer = await event.data.arrayBuffer();
          playAudioChunk(buffer);
        }
      }
    };

    return () => {
      ws.close();
      stopStreaming();
    };
  }, [role, isStreaming]);

  const playAudioChunk = async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    
    try {
      // Assuming Float32Array PCM data
      const float32Data = new Float32Array(arrayBuffer);
      const audioBuffer = ctx.createBuffer(1, float32Data.length, ctx.sampleRate);
      audioBuffer.getChannelData(0).set(float32Data);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  };

  const startStreaming = async () => {
    if (role === "broadcaster") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        const source = ctx.createMediaStreamSource(stream);
        
        // Simple script processor for chunking (deprecated but easiest for this demo without worker complexity)
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(inputData.buffer);
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination); // Required to trigger onaudioprocess
        
        setIsStreaming(true);
        addLog("Broadcasting started.");
      } catch (err) {
        addLog(`Camera/Mic Error: ${err}`);
      }
    } else {
      setIsStreaming(true);
      addLog("Listening started.");
    }
  };

  const stopStreaming = () => {
    setIsStreaming(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    addLog(`${role === "broadcaster" ? "Broadcasting" : "Listening"} stopped.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Radio className="text-blue-500" />
              Audio TCP Stream
            </h1>
            <p className="text-slate-400 mt-1">Web-based real-time audio transmission</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full text-xs font-mono border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Server: READY
          </div>
        </header>

        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4">
          <Info className="text-blue-400 shrink-0" />
          <p className="text-sm text-blue-200">
            This app is a web implementation of the Rust Audio TCP Streamer. 
            Source code of the original Rust implementation is available in the project files for reference.
          </p>
        </div>

        <main className="grid md:grid-cols-2 gap-8">
          
          {/* Controls */}
          <section className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Terminal className="text-slate-400 w-5 h-5" />
                Control Panel
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => { setRole("broadcaster"); stopStreaming(); }}
                    className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                      role === "broadcaster" 
                        ? "bg-blue-600/20 border-blue-500 text-blue-50" 
                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600 text-slate-400"
                    }`}
                  >
                    <Mic className="mb-2" />
                    <span className="font-medium text-sm">Broadcaster</span>
                  </button>
                  <button
                    onClick={() => { setRole("listener"); stopStreaming(); }}
                    className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                      role === "listener" 
                        ? "bg-purple-600/20 border-purple-500 text-purple-50" 
                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600 text-slate-400"
                    }`}
                  >
                    <Headphones className="mb-2" />
                    <span className="font-medium text-sm">Listener</span>
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {role && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="pt-4"
                    >
                      <button
                        onClick={isStreaming ? stopStreaming : startStreaming}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                          isStreaming 
                            ? "bg-red-600 hover:bg-red-700 active:scale-95 text-white" 
                            : "bg-green-600 hover:bg-green-700 active:scale-95 text-white shadow-lg shadow-green-900/20"
                        }`}
                      >
                        {isStreaming ? (
                          <>
                            {role === "broadcaster" ? <MicOff /> : <VolumeX />}
                            Stop {role === "broadcaster" ? "Broadcast" : "Reception"}
                          </>
                        ) : (
                          <>
                            {role === "broadcaster" ? <Radio /> : <Volume2 />}
                            Start {role === "broadcaster" ? "Broadcast" : "Listening"}
                          </>
                        )
                        }
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Status Card */}
            <div className={`p-6 rounded-2xl border transition-colors ${
              isStreaming 
                ? "bg-slate-900 border-green-500/30" 
                : "bg-slate-900 border-slate-800"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400 font-medium">Stream Status</span>
                {isStreaming && (
                  <span className="text-[10px] bg-green-500 text-slate-950 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isStreaming ? "bg-green-500/10 text-green-500" : "bg-slate-800 text-slate-500"
                }`}>
                  {role === "broadcaster" ? <Mic size={24} /> : <Headphones size={24} />}
                </div>
                <div>
                  <div className="text-lg font-bold text-white">
                    {isStreaming ? (role === "broadcaster" ? "Transmitting..." : "Receiving Stream") : "Inactive"}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {role ? `Mode: ${role.toUpperCase()}` : "Select a role to begin"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Console Output */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[400px] md:h-auto shadow-xl">
            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400 flex items-center gap-2">
                <Terminal size={14} />
                CONSOLE_LOG
              </span>
              <button 
                onClick={() => setLogs(["Console cleared."])}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest font-bold"
              >
                Clear
              </button>
            </div>
            <div className="p-4 font-mono text-[11px] md:text-sm overflow-y-auto flex-1 bg-black/30 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-600 shrink-0">[{i}]</span>
                  <span className={log.includes("error") ? "text-red-400" : "text-green-400"}>
                    {log}
                  </span>
                </div>
              ))}
              <div className="animate-pulse bg-green-500/50 w-2 h-4 inline-block ml-1"></div>
            </div>
          </section>

        </main>

        <footer className="pt-8 text-center border-t border-slate-900">
          <p className="text-slate-600 text-xs">
            Inspired by <strong>Rust Audio TCP Stream</strong>. 
            Implementation uses Web Audio API & WebSockets.
          </p>
        </footer>
      </div>
    </div>
  );
}

