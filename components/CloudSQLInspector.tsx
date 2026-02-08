
import React, { useState, useEffect, useCallback } from 'react';
import { executeSqlQuery, listSqlTables, getSqlTableStats } from '../services/sqlService';
import { ArrowLeft, RefreshCw, Server, Database, Terminal, Play, Loader2, ChevronRight, ShieldAlert, Activity, Fingerprint, Info, Table as TableIcon, ShieldCheck, Zap } from 'lucide-react';
import { safeJsonStringify } from '../utils/idUtils';

interface CloudSQLInspectorProps {
  onBack: () => void;
  onOpenManual?: () => void;
}

interface TestStep {
    id: string;
    label: string;
    status: 'idle' | 'running' | 'success' | 'failed';
    error?: string;
}

export const CloudSQLInspector: React.FC<CloudSQLInspectorProps> = ({ onBack, onOpenManual }) => {
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tableStats, setTableStats] = useState<{ size: string, rows: string } | null>(null);
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM information_schema.tables LIMIT 10;');
  const [results, setResults] = useState<{ rows: any[], rowCount: number, duration: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Diagnostic State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'pass' | 'fail' | 'idle'>('idle');

  const dispatchLog = (text: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { 
          detail: { text: `[Relational Audit] ${text}`, type } 
      }));
  };

  const runSelfTest = async () => {
    setIsTesting(true);
    setTestResult('idle');
    dispatchLog("Initiating Relational Self-Test...", "info");
    
    try {
        // 1. Connectivity Check
        dispatchLog("Step 1: Pinging SQL Proxy endpoint...", "info");
        const versionRes = await executeSqlQuery("SELECT version();");
        
        if (versionRes && versionRes.rows.length > 0) {
            const ver = versionRes.rows[0].version;
            dispatchLog(`Handshake Success: ${ver}`, "success");
            
            // 2. Permission Check
            dispatchLog("Step 2: Checking schema read permissions...", "info");
            await listSqlTables();
            dispatchLog("Step 3: Permission verified. Registry accessible.", "success");
            
            setTestResult('pass');
            dispatchLog("Relational Plane: OPERATIONAL.", "success");
            loadMetadata();
        } else {
            throw new Error("Empty response from SQL engine.");
        }
    } catch (e: any) {
        setTestResult('fail');
        const errorDetail = e.message || "Unknown Connection Error";
        dispatchLog(`Audit Failure: ${errorDetail}`, "error");
        
        // Detailed instructions for the user
        dispatchLog("--- SETUP REQUIRED ---", "warn");
        dispatchLog("1. Ensure your Cloud SQL Proxy / Backend endpoint is active at '/api/sql/refraction'.", "warn");
        dispatchLog("2. Verify GCP Service Account has 'Cloud SQL Client' and 'Cloud SQL Instance User' roles.", "warn");
        dispatchLog("3. Check if your current IP is whitelisted in the Cloud SQL instance networking settings.", "warn");
        dispatchLog("4. If using local emulation, ensure the database container is healthy and migrations are applied.", "warn");
        
        setError(`Connection Failed: ${errorDetail}. Check the Debug Console for setup instructions.`);
    } finally {
        setIsTesting(false);
    }
  };

  const loadMetadata = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const sqlTables = await listSqlTables();
        setTables(sqlTables);
    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => { 
      // Auto-run test on first mount to verify plane integrity
      runSelfTest();
  }, []);

  const handleRunQuery = async () => {
    if (!sqlQuery.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
        const res = await executeSqlQuery(sqlQuery);
        setResults(res);
        const tableMatch = sqlQuery.match(/FROM\s+"?(\w+)"?/i);
        if (tableMatch) {
            const stats = await getSqlTableStats(tableMatch[1]);
            setTableStats(stats);
            setActiveTable(tableMatch[1]);
        }
    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSelectTable = async (name: string) => {
      setActiveTable(name);
      const queryStr = `SELECT * FROM "${name}" LIMIT 50;`;
      setSqlQuery(queryStr);
      setIsLoading(true);
      setError(null);
      try {
          const [stats, res] = await Promise.all([
              getSqlTableStats(name),
              executeSqlQuery(queryStr)
          ]);
          setTableStats(stats);
          setResults(res);
      } catch (e: any) {
          setError(e.message);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <div className="relative">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter italic">
                        <Server className="text-indigo-400" /> Relational Inspector
                    </h1>
                    <div className={`w-2 h-2 rounded-full ${testResult === 'pass' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : testResult === 'fail' ? 'bg-red-500' : 'bg-slate-700 animate-pulse'}`}></div>
                </div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">PostgreSQL / Cloud SQL Proxy Plane</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <button 
                onClick={runSelfTest} 
                disabled={isTesting}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg border ${testResult === 'fail' ? 'bg-red-900/20 border-red-500/50 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
              >
                  {isTesting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>{testResult === 'fail' ? 'Retry Audit' : 'System Audit'}</span>
              </button>
              <button onClick={loadMetadata} className="p-2 text-slate-500 hover:text-white transition-all"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
              {onOpenManual && <button onClick={onOpenManual} className="p-2 text-slate-400 hover:text-white" title="SQL Manual"><Info size={18}/></button>}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <aside className="w-full lg:w-72 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Public Schema</h3>
                  <Database size={12} className="text-slate-700"/>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
                  {tables.map(t => (
                      <button 
                        key={t} 
                        onClick={() => handleSelectTable(t)}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center justify-between group ${activeTable === t ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900/50 border-transparent text-slate-400 hover:bg-slate-800'}`}
                      >
                          <div className="flex items-center gap-3">
                              <TableIcon size={14} className={activeTable === t ? 'text-white' : 'text-indigo-400'} />
                              <span className="text-xs font-bold truncate">{t}</span>
                          </div>
                          <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                  ))}
                  {tables.length === 0 && !isLoading && (
                      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 px-4">
                          <Database size={32} className="text-slate-800 opacity-20" />
                          <p className="text-[10px] text-slate-600 italic">No tables discovered in this node.</p>
                          {testResult === 'fail' && (
                              <button onClick={runSelfTest} className="text-[9px] font-black text-indigo-400 hover:text-white uppercase tracking-widest">Run Diagnostics</button>
                          )}
                      </div>
                  )}
              </div>
          </aside>

          <main className="flex-1 flex flex-col min-w-0 bg-black/20">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50 space-y-6 shrink-0">
                  <div className="flex items-start justify-between">
                      <div className="space-y-1">
                          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">SQL Command Core</h2>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                              <Activity size={12} className={testResult === 'pass' ? 'text-emerald-500' : 'text-slate-700'}/> {testResult === 'pass' ? 'Relational Handshake Active' : 'Awaiting Audit'}
                          </p>
                      </div>
                      {tableStats && (
                        <div className="flex gap-4 animate-fade-in">
                            <div className="bg-slate-950 border border-slate-800 px-5 py-2 rounded-2xl shadow-inner text-center">
                                <p className="text-[8px] font-black text-slate-600 uppercase">Disk Mass</p>
                                <p className="text-sm font-black text-emerald-400">{tableStats.size}</p>
                            </div>
                            <div className="bg-slate-950 border border-slate-800 px-5 py-2 rounded-2xl shadow-inner text-center">
                                <p className="text-[8px] font-black text-slate-600 uppercase">Row Density</p>
                                <p className="text-sm font-black text-indigo-400">{parseInt(tableStats.rows).toLocaleString()}</p>
                            </div>
                        </div>
                      )}
                  </div>

                  <div className="relative group">
                      <div className="absolute top-3 left-4 text-indigo-500 opacity-50 group-focus-within:opacity-100 transition-opacity"><Terminal size={14}/></div>
                      <textarea 
                        value={sqlQuery} 
                        onChange={e => setSqlQuery(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-[1.5rem] pl-10 pr-4 py-4 text-xs font-mono text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner h-24 resize-none"
                        spellCheck={false}
                        placeholder="SELECT * FROM table;"
                      />
                      <div className="absolute bottom-3 right-4 flex items-center gap-3">
                        {results && <span className="text-[9px] font-mono text-slate-600 uppercase tabular-nums">{results.rowCount} results • {results.duration}ms</span>}
                        <button 
                            onClick={handleRunQuery}
                            disabled={isLoading || !sqlQuery.trim() || testResult !== 'pass'}
                            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-30"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                        </button>
                      </div>
                  </div>
              </div>

              <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
                  {error ? (
                    <div className="p-8 bg-red-900/20 border border-red-900/50 rounded-3xl flex items-start gap-4 text-red-200 animate-fade-in">
                        <ShieldAlert className="text-red-500 shrink-0" size={24}/>
                        <div className="flex-1 font-mono text-xs">
                            <p className="font-bold uppercase mb-2">Relational Logic Breach</p>
                            <p className="whitespace-pre-wrap">{error}</p>
                        </div>
                    </div>
                  ) : !results ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-6 opacity-20">
                        <Fingerprint size={80} strokeWidth={1}/>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter">Awaiting Refraction</h3>
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[10px] border-collapse">
                                <thead className="bg-slate-950 text-slate-400 font-black uppercase tracking-widest border-b border-slate-800">
                                    <tr>
                                        {Object.keys(results.rows[0] || {}).map(key => (
                                            <th key={key} className="px-6 py-4 whitespace-nowrap">{key}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {results.rows.map((row, i) => (
                                        <tr key={i} className="hover:bg-indigo-600/5 transition-colors group">
                                            {Object.values(row).map((val: any, j) => (
                                                <td key={j} className="px-6 py-3 font-mono text-slate-300 max-w-xs truncate" title={typeof val === 'string' ? val : safeJsonStringify(val)}>
                                                    {val === null ? <span className="text-slate-700 italic">null</span> : typeof val === 'object' ? '{...}' : String(val)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {results.rows.length === 0 && (
                                        <tr><td colSpan={100} className="px-6 py-20 text-center text-slate-700 italic">Empty set returned.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                  )}
              </div>
          </main>
      </div>
    </div>
  );
};

export default CloudSQLInspector;
