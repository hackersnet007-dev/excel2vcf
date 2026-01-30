import * as XLSX from 'xlsx';
import { Contact } from '../types';

// Helper to check if string looks like a phone number
const isPhoneLike = (cell: any): boolean => {
  if (!cell) return false;
  const str = String(cell).trim();
  const digits = str.replace(/\D/g, '');
  return digits.length >= 6;
};

// Helper to check if string looks like a name
const isNameLike = (cell: any): boolean => {
  if (!cell) return false;
  const str = String(cell).trim();
  if (isPhoneLike(str)) return false;
  if (str.includes('@')) return false;
  return /[a-zA-Z]/.test(str);
};

export const detectColumns = (data: any[][]): { nameIndex: number, numberIndex: number } => {
  if (!data || data.length === 0) return { nameIndex: 0, numberIndex: 1 };

  const sample = data.slice(0, 50);
  const colStats: Record<number, { phoneScore: number; nameScore: number; count: number }> = {};

  sample.forEach(row => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, idx) => {
      if (!colStats[idx]) colStats[idx] = { phoneScore: 0, nameScore: 0, count: 0 };
      colStats[idx].count++;
      
      if (isPhoneLike(cell)) {
        colStats[idx].phoneScore++;
      } else if (isNameLike(cell)) {
        colStats[idx].nameScore++;
      }
    });
  });

  let bestPhoneIdx = -1;
  let bestPhoneScoreVal = 0;

  Object.keys(colStats).forEach((key) => {
    const idx = Number(key);
    const stats = colStats[idx];
    const score = stats.count > 0 ? stats.phoneScore / stats.count : 0;
    
    if (score > 0.4 && score > bestPhoneScoreVal) {
      bestPhoneScoreVal = score;
      bestPhoneIdx = idx;
    }
  });

  let bestNameIdx = -1;
  let bestNameScoreVal = 0;

  Object.keys(colStats).forEach((key) => {
    const idx = Number(key);
    if (idx === bestPhoneIdx) return;

    const stats = colStats[idx];
    const score = stats.count > 0 ? stats.nameScore / stats.count : 0;

    if (score > 0.4 && score > bestNameScoreVal) {
      bestNameScoreVal = score;
      bestNameIdx = idx;
    }
  });

  if (bestPhoneIdx === -1) bestPhoneIdx = 1; 
  if (bestNameIdx === -1) bestNameIdx = 0;   
  
  if (bestNameIdx === bestPhoneIdx) {
      bestNameIdx = bestPhoneIdx === 0 ? 1 : 0;
  }

  return { nameIndex: bestNameIdx, numberIndex: bestPhoneIdx };
};

export const readExcelFile = async (file: File): Promise<{ workbook: XLSX.WorkBook; sheetNames: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        if (!e.target?.result) throw new Error("Failed to read file content.");
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
            throw new Error("No sheets found in the Excel file.");
        }

        resolve({ workbook, sheetNames: workbook.SheetNames });
      } catch (error) {
        console.error("Parse Error:", error);
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("File reading failed"));
    reader.readAsArrayBuffer(file);
  });
};

export const getSheetData = (workbook: XLSX.WorkBook, sheetName: string): any[][] => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return [];
    return XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
};

export const processContacts = (
    data: any[][], 
    nameIndex: number, 
    numberIndex: number,
    filterIndex: number = -1,
    filterText: string = ''
): Contact[] => {
  if (!data || data.length === 0) return [];
  
  // Prepare filter terms: split by comma, trim, lowercase
  const filterTerms = filterText
    ? filterText.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
    : [];

  return data.map((row, index) => {
    // Filter Logic: If filter is active and row doesn't match ANY term
    if (filterIndex !== -1 && filterTerms.length > 0) {
        const cellValue = row[filterIndex] !== undefined && row[filterIndex] !== null 
            ? String(row[filterIndex]).toLowerCase() 
            : '';
        
        // Check if cell contains at least one of the filter terms
        const matches = filterTerms.some(term => cellValue.includes(term));
        if (!matches) {
            return null;
        }
    }

    // Safety check if row doesn't have these columns
    const rawName = row[nameIndex] ? String(row[nameIndex]).trim() : '';
    const rawNumber = row[numberIndex] ? String(row[numberIndex]).trim() : '';
    
    if (!rawName && !rawNumber) return null;

    const cleanedNumber = rawNumber.replace(/\D/g, '');
    // Basic validation: needs name and at least 10 digits
    const isValid = cleanedNumber.length >= 10 && rawName.length > 0;

    return {
      id: `row-${index}`,
      originalName: rawName,
      originalNumber: rawNumber,
      cleanedNumber,
      isValid
    };
  }).filter((c): c is Contact => c !== null);
};

// Deprecated: Kept for backward compatibility if needed
export const parseExcelFile = async (file: File): Promise<Contact[]> => {
  const { workbook, sheetNames } = await readExcelFile(file);
  const data = getSheetData(workbook, sheetNames[0]);
  const { nameIndex, numberIndex } = detectColumns(data);
  return processContacts(data, nameIndex, numberIndex);
};

export const generateVCFContent = (contacts: Contact[], prefix: string): string => {
  let vcfString = '';

  contacts.forEach(contact => {
    if (!contact.isValid) return;

    const fullName = `${prefix}${contact.originalName}`.trim();
    
    vcfString += 'BEGIN:VCARD\n';
    vcfString += 'VERSION:3.0\n';
    vcfString += `FN:${fullName}\n`;
    vcfString += `N:;${fullName};;;\n`;
    vcfString += `TEL;TYPE=CELL:${contact.cleanedNumber}\n`;
    vcfString += 'END:VCARD\n';
  });

  return vcfString;
};

export const downloadVCF = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const shareVCF = async (content: string, filename: string): Promise<boolean> => {
  if (!navigator.share) return false;

  const blob = new Blob([content], { type: 'text/vcard' });
  const file = new File([blob], filename, { type: 'text/vcard' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Contact List VCF',
        text: 'Here is your converted contact list.'
      });
      return true;
    } catch (error) {
      console.log('Share was canceled or failed', error);
      return false; 
    }
  }
  return false;
};