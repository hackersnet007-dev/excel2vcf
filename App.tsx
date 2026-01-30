import React, { useState, useMemo, useEffect } from 'react';
import { Dropzone } from './components/Dropzone';
import { PreviewTable } from './components/PreviewTable';
import { readExcelFile, getSheetData, detectColumns, processContacts, generateVCFContent, downloadVCF, shareVCF } from './utils/excelParser';
import { suggestPrefix } from './services/geminiService';
import { Contact, Step } from './types';
import { 
  FileCheck, 
  Settings, 
  Download, 
  ArrowRight, 
  RefreshCcw, 
  Sparkles, 
  Trash2,
  Users,
  CheckCircle2,
  Phone,
  Smartphone,
  Share2,
  TableProperties,
  Sheet,
  Filter,
  ListFilter
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.UPLOAD);
  
  // Data State
  const [workbook, setWorkbook] = useState<any>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [rawData, setRawData] = useState<any[][]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  // Configuration State
  const [nameColIdx, setNameColIdx] = useState<number>(0);
  const [numberColIdx, setNumberColIdx] = useState<number>(1);
  const [prefix, setPrefix] = useState('');
  const [filterColIdx, setFilterColIdx] = useState<number>(-1);
  const [filterText, setFilterText] = useState<string>('');
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [fileName, setFileName] = useState('contacts');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Reactive Processing: Update contacts whenever data or config changes
  useEffect(() => {
    if (rawData.length > 0) {
        const processed = processContacts(rawData, nameColIdx, numberColIdx, filterColIdx, filterText);
        setContacts(processed);
    }
  }, [rawData, nameColIdx, numberColIdx, filterColIdx, filterText]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      valid: contacts.filter(c => c.isValid).length,
      invalid: contacts.filter(c => !c.isValid).length
    };
  }, [contacts]);

  // Generate options for column select dropdowns
  const columnOptions = useMemo(() => {
    if (rawData.length === 0) return [];
    
    // Use the first row as headers, or create generic labels if empty
    const firstRow = rawData[0];
    const maxCols = firstRow ? firstRow.length : 0;
    
    // Fallback: Check first 10 rows to find max column count if first row is weird
    let actualMaxCols = maxCols;
    rawData.slice(0, 10).forEach(row => {
        if (row.length > actualMaxCols) actualMaxCols = row.length;
    });

    return Array.from({ length: actualMaxCols }).map((_, idx) => {
      const colLetter = String.fromCharCode(65 + (idx % 26)); // A, B, C...
      const prefix = idx >= 26 ? `Col ${idx + 1}` : `Col ${colLetter}`; // Simple fallback for many columns
      
      let headerVal = '';
      if (firstRow && firstRow[idx]) {
          const val = String(firstRow[idx]);
          headerVal = val.length > 20 ? val.substring(0, 20) + '...' : val;
      }
      
      return {
        value: idx,
        label: headerVal ? `${prefix}: ${headerVal}` : `${prefix}`
      };
    });
  }, [rawData]);

  // Generate unique values for the filter column
  const filterUniqueValues = useMemo(() => {
    if (filterColIdx === -1 || rawData.length === 0) return [];
    
    const values = new Set<string>();
    // Skip header row usually, but let's just dump all unique strings
    // We start from row 1 to skip header if it exists
    rawData.slice(1).forEach(row => {
        if (row[filterColIdx] !== undefined && row[filterColIdx] !== null) {
            const val = String(row[filterColIdx]).trim();
            if (val) values.add(val);
        }
    });
    
    return Array.from(values).sort();
  }, [rawData, filterColIdx]);

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    try {
      const { workbook, sheetNames } = await readExcelFile(file);
      setWorkbook(workbook);
      setSheetNames(sheetNames);
      
      // Default to first sheet
      const initialSheet = sheetNames[0];
      setCurrentSheet(initialSheet);
      
      const data = getSheetData(workbook, initialSheet);
      setRawData(data);
      
      // Auto-detect columns
      const { nameIndex, numberIndex } = detectColumns(data);
      setNameColIdx(nameIndex);
      setNumberColIdx(numberIndex);
      
      // Reset filter
      setFilterColIdx(-1);
      setFilterText('');
      
      // processContacts will be called by useEffect

      setFileName(file.name.replace(/\.[^/.]+$/, ""));
      setStep(Step.PREVIEW);
    } catch (error) {
      console.error("Failed to parse file", error);
      alert("Error parsing file. Please ensure it is a valid Excel file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetChange = (newSheetName: string) => {
    if (!workbook) return;
    setCurrentSheet(newSheetName);
    
    const data = getSheetData(workbook, newSheetName);
    setRawData(data);
    
    // Auto-detect columns again for new sheet
    const { nameIndex, numberIndex } = detectColumns(data);
    setNameColIdx(nameIndex);
    setNumberColIdx(numberIndex);
    
    // Reset Filter
    setFilterColIdx(-1);
    setFilterText('');
  };

  const handleDownload = async () => {
    const vcfContent = generateVCFContent(contacts, prefix);
    const finalName = `${fileName}_${currentSheet}_converted.vcf`;
    
    if (navigator.share) {
      const shared = await shareVCF(vcfContent, finalName);
      if (!shared) {
        downloadVCF(vcfContent, finalName);
      }
    } else {
      downloadVCF(vcfContent, finalName);
    }
    
    setStep(Step.DOWNLOAD);
  };

  const handleReset = () => {
    setContacts([]);
    setRawData([]);
    setWorkbook(null);
    setSheetNames([]);
    setPrefix('');
    setFilterColIdx(-1);
    setFilterText('');
    setStep(Step.UPLOAD);
  };

  const handleAiSuggest = async () => {
    setIsSuggesting(true);
    const validNames = contacts
      .filter(c => c.isValid && c.originalName)
      .map(c => c.originalName);
      
    if (validNames.length === 0) {
       alert("No valid names to analyze.");
       setIsSuggesting(false);
       return;
    }

    const suggestion = await suggestPrefix(validNames);
    if (suggestion) {
      setPrefix(suggestion);
    }
    setIsSuggesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm z-10 sticky top-0 safe-pt">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
               <Users className="text-white w-5 h-5" />
             </div>
             <div>
               <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 leading-none">
                 Excel2VCF
               </h1>
               <p className="text-[10px] text-gray-500 font-medium leading-none mt-1 uppercase tracking-wide">
                 By Prof. Sudhirkumar N. Rathod
               </p>
             </div>
          </div>
          <div className="flex items-center space-x-4">
             {deferredPrompt && (
               <button 
                 onClick={handleInstallClick}
                 className="hidden sm:flex items-center space-x-2 bg-gray-900 text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-800 transition-colors animate-pulse"
               >
                 <Smartphone size={14} />
                 <span>Install App</span>
               </button>
             )}
             <div className="flex space-x-2">
               <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${step === Step.UPLOAD ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
               <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${step === Step.PREVIEW ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
               <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${step === Step.DOWNLOAD ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 safe-pb">
        
        {/* Step 1: Upload */}
        {step === Step.UPLOAD && (
          <div className="animate-fade-in-up max-w-2xl mx-auto mt-12 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">
              Convert Contact Lists Instantly
            </h2>
            <p className="text-lg text-gray-500 mb-10">
              Clean, format, and convert Excel spreadsheets into mobile-ready VCF cards.
              <br/>Automatically removes invalid numbers (letters, too short).
            </p>
            <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} />
            {isLoading && (
              <div className="mt-8 flex items-center justify-center space-x-2 text-indigo-600">
                 <RefreshCcw className="animate-spin w-5 h-5" />
                 <span>Processing file...</span>
              </div>
            )}
            
            {deferredPrompt && (
               <div className="mt-8 sm:hidden">
                 <button 
                   onClick={handleInstallClick}
                   className="inline-flex items-center space-x-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg font-medium text-sm"
                 >
                   <Smartphone size={16} />
                   <span>Install as App</span>
                 </button>
               </div>
            )}
          </div>
        )}

        {/* Step 2: Configure & Preview */}
        {step === Step.PREVIEW && (
          <div className="animate-fade-in space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                 <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                    <FileCheck size={24} />
                 </div>
                 <div>
                    <p className="text-sm text-gray-500 font-medium">Total Rows</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                 <div className="p-3 bg-green-50 rounded-full text-green-600">
                    <CheckCircle2 size={24} />
                 </div>
                 <div>
                    <p className="text-sm text-gray-500 font-medium">Valid Contacts</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.valid}</p>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                 <div className="p-3 bg-red-50 rounded-full text-red-600">
                    <Trash2 size={24} />
                 </div>
                 <div>
                    <p className="text-sm text-gray-500 font-medium">Invalid / Removed</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.invalid}</p>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* Left: Configuration */}
               <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-24">
                    <div className="flex items-center space-x-2 mb-6">
                      <Settings className="text-gray-400 w-5 h-5" />
                      <h3 className="text-lg font-bold text-gray-900">Configuration</h3>
                    </div>

                    <div className="space-y-6">

                      {/* Sheet Selection */}
                      {sheetNames.length > 1 && (
                        <div className="space-y-4 pb-6 border-b border-gray-100">
                           <div className="flex items-center space-x-2 text-indigo-600 mb-2">
                             <Sheet size={16} />
                             <h4 className="text-sm font-semibold uppercase tracking-wider">Select Sheet</h4>
                           </div>
                           
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">
                               Sheet Name
                             </label>
                             <select
                                value={currentSheet}
                                onChange={(e) => handleSheetChange(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                             >
                                {sheetNames.map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                             </select>
                           </div>
                        </div>
                      )}
                      
                      {/* Column Selection */}
                      <div className="space-y-4 pb-6 border-b border-gray-100">
                         <div className="flex items-center space-x-2 text-indigo-600 mb-2">
                           <TableProperties size={16} />
                           <h4 className="text-sm font-semibold uppercase tracking-wider">Map Columns</h4>
                         </div>
                         
                         <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">
                             Name Column
                           </label>
                           <select
                              value={nameColIdx}
                              onChange={(e) => setNameColIdx(Number(e.target.value))}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                           >
                              {columnOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                           </select>
                         </div>

                         <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">
                             Number Column
                           </label>
                           <select
                              value={numberColIdx}
                              onChange={(e) => setNumberColIdx(Number(e.target.value))}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                           >
                              {columnOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                           </select>
                         </div>
                      </div>

                       {/* Filter Selection */}
                       <div className="space-y-4 pb-6 border-b border-gray-100">
                         <div className="flex items-center space-x-2 text-indigo-600 mb-2">
                           <Filter size={16} />
                           <h4 className="text-sm font-semibold uppercase tracking-wider">Filter Rows (Optional)</h4>
                         </div>
                         
                         <p className="text-xs text-gray-500">Only save rows where specific data matches.</p>

                         <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">
                             Filter Column
                           </label>
                           <select
                              value={filterColIdx}
                              onChange={(e) => setFilterColIdx(Number(e.target.value))}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                           >
                              <option value="-1">None (Process All)</option>
                              {columnOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                           </select>
                         </div>

                         {filterColIdx !== -1 && (
                            <div className="animate-fade-in space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Type values to match
                                    </label>
                                    <input
                                        type="text"
                                        value={filterText}
                                        onChange={(e) => setFilterText(e.target.value)}
                                        placeholder="e.g. Pune, HR, 2024 (Supports comma separated)"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Accepts words, numbers, and symbols.</p>
                                </div>
                                
                                {/* Quick Value Selector */}
                                <div>
                                    <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                                       <ListFilter size={12} />
                                       <span>Quick Select from Data ({filterUniqueValues.length} found)</span>
                                    </div>
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setFilterText(prev => prev ? `${prev}, ${e.target.value}` : e.target.value);
                                            }
                                        }}
                                        value=""
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-gray-50"
                                    >
                                        <option value="">Select a value to append...</option>
                                        {filterUniqueValues.map((val, idx) => (
                                            <option key={idx} value={val}>{val.length > 30 ? val.substring(0, 30) + '...' : val}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                         )}
                      </div>

                      {/* Prefix & Action */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Add Prefix (Optional)
                          </label>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={prefix}
                              onChange={(e) => setPrefix(e.target.value)}
                              placeholder="e.g. Work - "
                              className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                            />
                          </div>
                          
                          <button
                            onClick={handleAiSuggest}
                            disabled={isSuggesting}
                            className="mt-3 w-full flex items-center justify-center space-x-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-md transition-colors"
                          >
                            {isSuggesting ? (
                               <RefreshCcw className="w-3 h-3 animate-spin" />
                            ) : (
                               <Sparkles className="w-3 h-3" />
                            )}
                            <span>
                              {isSuggesting ? 'Thinking...' : 'AI Suggest Prefix'}
                            </span>
                          </button>
                        </div>

                        <button
                          onClick={handleDownload}
                          disabled={stats.valid === 0}
                          className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           {typeof navigator.share === 'function' ? <Share2 size={20} /> : <Download size={20} />}
                           <span>{typeof navigator.share === 'function' ? 'Share / Save VCF' : 'Download VCF'}</span>
                        </button>
                        
                        <button
                           onClick={handleReset}
                           className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
                        >
                          Upload a different file
                        </button>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Right: Table */}
               <div className="lg:col-span-2">
                  <PreviewTable contacts={contacts} prefix={prefix} />
               </div>
            </div>
          </div>
        )}

        {/* Step 3: Success State */}
        {step === Step.DOWNLOAD && (
           <div className="animate-fade-in max-w-md mx-auto mt-20 text-center p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
              <p className="text-gray-500 mb-8">
                Your VCF file has been generated. You can now import it into your phone or email client.
              </p>
              
              <button
                onClick={handleReset}
                className="inline-flex items-center space-x-2 text-indigo-600 font-medium hover:text-indigo-800"
              >
                <span>Convert another file</span>
                <ArrowRight size={16} />
              </button>
           </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center justify-center text-center space-y-3">
           <p className="text-sm text-gray-500 tracking-wide uppercase font-semibold">Designed & Generated by</p>
           <h3 className="text-xl font-bold text-gray-900">Prof. Sudhirkumar N. Rathod</h3>
           <a href="tel:+917972292310" className="inline-flex items-center space-x-2 text-indigo-600 font-semibold bg-indigo-50 hover:bg-indigo-100 px-5 py-2 rounded-full transition-colors">
             <Phone size={18} />
             <span>+91 79722 92310</span>
           </a>
        </div>
      </footer>
    </div>
  );
};

export default App;