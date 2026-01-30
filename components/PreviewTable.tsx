import React from 'react';
import { Contact } from '../types';
import { CheckCircle, XCircle } from 'lucide-react';

interface PreviewTableProps {
  contacts: Contact[];
  prefix: string;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({ contacts, prefix }) => {
  // Show first 50 contacts for performance in preview
  const displayContacts = contacts.slice(0, 50);
  const remainingCount = Math.max(0, contacts.length - 50);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[400px]">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Data Preview</h3>
        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
          Displaying first 50 of {contacts.length} rows
        </span>
      </div>
      <div className="overflow-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Original Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preview Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Original Number
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayContacts.map((contact) => (
              <tr key={contact.id} className={contact.isValid ? 'bg-white' : 'bg-red-50'}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {contact.isValid ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle size={16} className="mr-2" />
                      <span className="text-xs font-medium">Valid</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600">
                      <XCircle size={16} className="mr-2" />
                      <span className="text-xs font-medium">Invalid</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {contact.originalName || <span className="text-gray-400 italic">Empty</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  {contact.isValid ? (
                    <>
                      <span className="text-indigo-600">{prefix}</span>
                      {contact.originalName}
                    </>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {contact.cleanedNumber}
                  {contact.cleanedNumber.length > 0 && contact.cleanedNumber.length < 10 && (
                    <span className="ml-2 text-xs text-red-500">({contact.cleanedNumber.length} digits)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {remainingCount > 0 && (
           <div className="p-4 text-center text-sm text-gray-500 border-t border-gray-100">
             ... and {remainingCount} more rows
           </div>
        )}
      </div>
    </div>
  );
};