// components/Transactions.tsx

import React, { useState, useMemo } from 'react';
import { TransactionLog, UserRole, InventoryItem, MaterialOutRecord, MaterialInRecord } from '../types';
import { ArrowUpRight, ArrowDownLeft, Search, Send, X, Loader2, FileText, Hash, CreditCard, User, ChevronDown, ChevronUp, Box, Calendar, ShoppingBag, PackagePlus } from 'lucide-react';
import { transactionApi, inventoryApi } from '../services/api';

interface TransactionsProps {
  transactions: TransactionLog[];
  setTransactions: React.Dispatch<React.SetStateAction<TransactionLog[]>>;
  items?: InventoryItem[];
  setItems?: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  userRole: UserRole;
}

// Helper Grouping
interface TransactionGroup {
    groupKey: string; // ID Group (IssueNo atau GRNo)
    date: string;
    receiver: string;
    secondaryInfo: string; // WBS atau PO
    items: TransactionLog[];
    totalQty: number;
    itemCount: number;
}

export const Transactions: React.FC<TransactionsProps> = ({ transactions, setTransactions, items, setItems, userRole }) => {
  const [activeTab, setActiveTab] = useState<'IN' | 'OUT'>('IN');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isOutboundModalOpen, setIsOutboundModalOpen] = useState(false);
  const [isInboundModalOpen, setIsInboundModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Pagination & UI States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Form Data States
  const [outFormData, setOutFormData] = useState<Partial<MaterialOutRecord>>({
      issueNumber: '', wbs: '', glAccount: '', glNumber: '', goodReceipt: '', remarks: '',
      date: new Date().toISOString().split('T')[0]
  });

  const [inFormData, setInFormData] = useState<Partial<MaterialInRecord>>({
      grNumber: '', po: '', wbs: '', reference: '', goodReceipt: '', remarks: '',
      date: new Date().toISOString().split('T')[0]
  });
  
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [txQty, setTxQty] = useState(1);

  // --- 1. FILTERING & GROUPING LOGIC ---
  const filteredRawTransactions = useMemo(() => {
      return transactions
        .filter(t => t.type === activeTab)
        .filter(t => 
          t.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
          t.materialNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.issueNumber || t.grNumber)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.remark?.toLowerCase().includes(searchTerm.toLowerCase())
        );
  }, [transactions, activeTab, searchTerm]);

  const groupedTransactions = useMemo(() => {
      const groups: Record<string, TransactionGroup> = {};

      filteredRawTransactions.forEach(tx => {
          // Key: OUT -> Issue Number, IN -> GR Number
          const key = activeTab === 'OUT' 
             ? (tx.issueNumber || 'MISC-OUT') 
             : (tx.grNumber || 'MISC-IN');

          if (!groups[key]) {
              groups[key] = {
                  groupKey: key,
                  date: tx.date,
                  receiver: tx.receiver || '-',
                  secondaryInfo: activeTab === 'OUT' ? (tx.wbs || '-') : (tx.po || '-'),
                  items: [],
                  totalQty: 0,
                  itemCount: 0
              };
          }
          groups[key].items.push(tx);
          groups[key].totalQty += tx.quantity;
          groups[key].itemCount += 1;
      });

      return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredRawTransactions, activeTab]);

  // --- 2. PAGINATION LOGIC ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = groupedTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(groupedTransactions.length / itemsPerPage);

  // Reset page on tab change
  useMemo(() => { setCurrentPage(1); }, [activeTab, searchTerm]);

  // --- 3. HANDLERS ---

  const toggleGroupExpansion = (key: string) => {
      const newSet = new Set(expandedGroups);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      setExpandedGroups(newSet);
  };

  // -- CREATE OUTBOUND --
  const handleCreateOutbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items || !selectedMaterialId) return;

    const selectedItem = items.find(i => i.id === selectedMaterialId);
    if (!selectedItem) return alert("Invalid material");
    if (txQty > selectedItem.quantity) return alert(`Insufficient stock! Available: ${selectedItem.quantity}`);

    setIsSaving(true);
    const payload: MaterialOutRecord = {
        id: 0,
        materialNo: selectedItem.materialNo,
        materialDesc: selectedItem.name,
        quantity: txQty,
        uom: selectedItem.uom,
        date: outFormData.date!,
        sloc: selectedItem.sloc,
        goodReceipt: outFormData.goodReceipt || 'Unknown',
        remarks: outFormData.remarks || '',
        createdAt: new Date().toISOString(),
        issueNumber: outFormData.issueNumber || `ISS-${Date.now()}`,
        wbs: outFormData.wbs || '',
        glNumber: outFormData.glNumber || '',
        glAccount: outFormData.glAccount || '',
        keterangan: outFormData.remarks || ''
    };

    const success = await transactionApi.createOutbound(payload);

    if (success) {
        const newLog: TransactionLog = {
            id: `NEW-${Date.now()}`,
            materialNo: payload.materialNo,
            itemName: payload.materialDesc,
            sku: payload.materialNo,
            type: 'OUT',
            quantity: payload.quantity,
            date: payload.date,
            status: 'COMPLETED',
            issueNumber: payload.issueNumber,
            wbs: payload.wbs,
            glAccount: payload.glAccount,
            receiver: payload.goodReceipt,
            remark: payload.remarks
        };
        setTransactions([newLog, ...transactions]);

        if (setItems) {
            setItems(items.map(i => i.id === selectedMaterialId ? { ...i, quantity: i.quantity - txQty } : i));
        }
        setIsOutboundModalOpen(false);
        setOutFormData(prev => ({ ...prev, remarks: '' })); 
        setSelectedMaterialId('');
        setTxQty(1);
    }
    setIsSaving(false);
  };

  // -- CREATE INBOUND --
  const handleCreateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items || !selectedMaterialId) return;

    const selectedItem = items.find(i => i.id === selectedMaterialId);
    if (!selectedItem) return alert("Invalid material");

    setIsSaving(true);
    const payload: MaterialInRecord = {
        id: 0,
        materialNo: selectedItem.materialNo,
        materialDesc: selectedItem.name,
        quantity: txQty,
        uom: selectedItem.uom,
        date: inFormData.date!,
        sloc: selectedItem.sloc,
        grNumber: inFormData.grNumber || `GR-${Date.now()}`,
        goodReceipt: inFormData.goodReceipt || 'Warehouse',
        po: inFormData.po || '',
        wbs: inFormData.wbs || '',
        reference: inFormData.reference || '',
        remarks: inFormData.remarks || ''
    };

    const success = await transactionApi.createInbound(payload);

    if (success) {
        const newLog: TransactionLog = {
            id: `IN-${Date.now()}`,
            materialNo: payload.materialNo,
            itemName: payload.materialDesc,
            sku: payload.materialNo,
            type: 'IN',
            quantity: payload.quantity,
            date: payload.date,
            status: 'COMPLETED',
            grNumber: payload.grNumber,
            po: payload.po,
            wbs: payload.wbs,
            receiver: payload.goodReceipt,
            remark: payload.remarks
        };
        setTransactions([newLog, ...transactions]);

        // Update Stok Lokal (Tambah)
        if (setItems) {
            setItems(items.map(i => i.id === selectedMaterialId ? { ...i, quantity: i.quantity + txQty } : i));
        }
        setIsInboundModalOpen(false);
        setInFormData(prev => ({ ...prev, remarks: '' })); 
        setSelectedMaterialId('');
        setTxQty(1);
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 min-h-[80vh]">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <h2 className="text-3xl font-bold text-white">Material Transactions</h2>
            <p className="text-slate-400 text-sm font-mono">Warehouse Logistics Control</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
           <button onClick={() => setIsInboundModalOpen(true)} className="flex-1 md:flex-none px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105">
               <ArrowDownLeft className="w-4 h-4" /> Inbound
           </button>
           <button onClick={() => setIsOutboundModalOpen(true)} className="flex-1 md:flex-none px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105">
               <ArrowUpRight className="w-4 h-4" /> Outbound
           </button>
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center shadow-md">
         <div className="bg-white/5 p-1 rounded-xl flex w-full md:w-auto">
             <button onClick={() => setActiveTab('IN')} className={`flex-1 md:flex-none px-8 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'IN' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Inbound</button>
             <button onClick={() => setActiveTab('OUT')} className={`flex-1 md:flex-none px-8 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'OUT' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Outbound</button>
         </div>
         
         <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                placeholder={activeTab === 'OUT' ? "Search Issue No, Project, Receiver..." : "Search GR No, PO, Reference..."}
                className="bg-transparent border-none outline-none text-white w-full pl-9 font-mono text-sm placeholder:text-slate-600" 
            />
         </div>
      </div>

      {/* === LIST VIEW (GROUPED) === */}
      <div className="space-y-4">
          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-black/20 rounded-xl border border-white/5">
              <div className="col-span-2">Date</div>
              <div className="col-span-3">{activeTab === 'OUT' ? 'Issue Number' : 'GR Number'}</div>
              <div className="col-span-2">{activeTab === 'OUT' ? 'Receiver' : 'Receiver / Dept'}</div>
              <div className="col-span-2">{activeTab === 'OUT' ? 'Project / WBS' : 'Purchase Order'}</div>
              <div className="col-span-2 text-center">Total Qty</div>
              <div className="col-span-1 text-right">Action</div>
          </div>

          {/* Groups List */}
          {currentData.map((g) => {
              const isExpanded = expandedGroups.has(g.groupKey);
              const themeColor = activeTab === 'OUT' ? 'rose' : 'emerald';
              const Icon = activeTab === 'OUT' ? FileText : PackagePlus;

              return (
                <div key={g.groupKey} className={`glass-panel rounded-2xl overflow-hidden border transition-all duration-300 ${isExpanded ? `border-${themeColor}-500/30 shadow-lg` : 'border-white/5'}`}>
                    
                    {/* Group Header */}
                    <div onClick={() => toggleGroupExpansion(g.groupKey)} className="p-4 md:p-5 cursor-pointer hover:bg-white/5 transition-colors">
                        {/* Mobile Header */}
                        <div className="md:hidden">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className={`flex items-center gap-2 text-${themeColor}-400 font-bold mb-1`}>
                                        <Icon className="w-4 h-4" />
                                        <span>{g.groupKey}</span>
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono">{g.date}</span>
                                </div>
                                <span className={`bg-${themeColor}-500/10 text-${themeColor}-400 border border-${themeColor}-500/20 px-2 py-1 rounded text-[10px] font-bold`}>
                                    {g.totalQty} Units
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                                <div className="bg-black/20 p-2 rounded">
                                    <span className="block text-[10px] text-slate-500 uppercase">Ref/PO</span>
                                    {g.secondaryInfo}
                                </div>
                                <div className="bg-black/20 p-2 rounded">
                                    <span className="block text-[10px] text-slate-500 uppercase">Person</span>
                                    {g.receiver}
                                </div>
                            </div>
                            <div className="flex justify-center mt-3">
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                            </div>
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-2 text-slate-300 font-mono text-sm">{g.date}</div>
                            <div className={`col-span-3 font-bold text-white flex items-center gap-2`}>
                                <div className={`p-1.5 bg-${themeColor}-500/10 rounded text-${themeColor}-400`}><Icon className="w-4 h-4" /></div>
                                {g.groupKey}
                            </div>
                            <div className="col-span-2 text-sm text-slate-300">{g.receiver}</div>
                            <div className="col-span-2">
                                <span className="px-2 py-1 rounded bg-white/5 text-xs font-mono text-slate-400 border border-white/10">{g.secondaryInfo}</span>
                            </div>
                            <div className="col-span-2 text-center">
                                <span className={`text-${themeColor}-400 font-bold`}>{g.totalQty}</span> <span className="text-slate-500 text-xs">units</span>
                            </div>
                            <div className="col-span-1 text-right">
                                <button className={`p-2 rounded-lg transition-all ${isExpanded ? `bg-${themeColor}-600 text-white` : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Expanded Items Table */}
                    {isExpanded && (
                        <div className="bg-black/30 border-t border-white/5 p-0 md:p-4 animate-in slide-in-from-top-2">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white/5 text-[10px] uppercase text-slate-500 font-bold">
                                        <tr>
                                            <th className="px-4 py-3 pl-6">Material No</th>
                                            <th className="px-4 py-3">Description</th>
                                            <th className="px-4 py-3 text-center">Qty</th>
                                            {activeTab === 'OUT' ? (
                                                <th className="px-4 py-3">GL Account</th>
                                            ) : (
                                                <th className="px-4 py-3">Ref / WBS</th>
                                            )}
                                            <th className="px-4 py-3">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {g.items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white/5">
                                                <td className={`px-4 py-3 pl-6 font-mono text-${themeColor}-300`}>{item.materialNo}</td>
                                                <td className="px-4 py-3 font-bold text-slate-200">{item.itemName}</td>
                                                <td className="px-4 py-3 text-center font-mono font-bold text-white">{item.quantity}</td>
                                                <td className="px-4 py-3 text-xs font-mono text-slate-400">
                                                    {activeTab === 'OUT' ? item.glAccount : (item.reference || item.wbs || '-')}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 italic">{item.remark || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
              );
          })}

          {currentData.length === 0 && (
             <div className="text-center py-12 text-slate-500 glass-panel rounded-2xl border border-white/5">
                 <Box className="w-12 h-12 mx-auto mb-3 opacity-20" />
                 No {activeTab === 'IN' ? 'Inbound' : 'Outbound'} transactions found.
             </div>
          )}
      </div>

      {/* PAGINATION CONTROLS */}
      <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5">
         <div className="text-xs text-slate-400">Page <span className="text-white font-bold">{currentPage}</span> of {totalPages || 1}</div>
         <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-30 text-white"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-30 text-white"><ChevronRight className="w-4 h-4" /></button>
         </div>
      </div>

      {/* =================== MODALS =================== */}
      
      {/* INBOUND MODAL */}
      {isInboundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsInboundModalOpen(false)}></div>
            <div className="relative w-full max-w-2xl glass-panel bg-[#0a0a0a] rounded-3xl p-6 border border-emerald-500/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 sticky top-0 bg-[#0a0a0a] z-10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><ArrowDownLeft className="w-5 h-5 text-emerald-500" /> Incoming Material (GR)</h3>
                    <button onClick={() => setIsInboundModalOpen(false)} className="text-slate-400 hover:text-white"><X /></button>
                </div>
                <form onSubmit={handleCreateInbound} className="space-y-5">
                    {/* Material Select */}
                    <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-emerald-400 uppercase mb-2 block">Select Material</label>
                                <select required value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500">
                                    <option value="">Select Material...</option>
                                    {items?.map(i => <option key={i.id} value={i.id}>{i.name} ({i.materialNo})</option>)}
                                </select>
                            </div>
                            <div className="w-full md:w-32">
                                <label className="text-xs font-bold text-emerald-400 uppercase mb-2 block">Qty</label>
                                <input type="number" min="1" required value={txQty} onChange={e => setTxQty(parseInt(e.target.value))} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-bold focus:border-emerald-500" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">GR Number</label>
                            <input type="text" required value={inFormData.grNumber} onChange={e => setInFormData({...inFormData, grNumber: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 font-mono" placeholder="GR-2024-..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Purchase Order (PO)</label>
                            <input type="text" value={inFormData.po} onChange={e => setInFormData({...inFormData, po: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 font-mono" placeholder="PO-..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">WBS / Project</label>
                            <input type="text" value={inFormData.wbs} onChange={e => setInFormData({...inFormData, wbs: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Receiver / By</label>
                            <input type="text" required value={inFormData.goodReceipt} onChange={e => setInFormData({...inFormData, goodReceipt: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500" placeholder="Received by..." />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 mb-2">Reference Doc</label>
                            <input type="text" value={inFormData.reference} onChange={e => setInFormData({...inFormData, reference: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500" placeholder="Delivery Note / Surat Jalan" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Remarks</label>
                        <textarea value={inFormData.remarks} onChange={e => setInFormData({...inFormData, remarks: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 h-20 resize-none" placeholder="Notes..."></textarea>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-[#0a0a0a] pb-2">
                         <button type="button" onClick={() => setIsInboundModalOpen(false)} className="px-6 py-3 rounded-xl text-slate-400 hover:text-white font-bold">Cancel</button>
                         <button type="submit" disabled={isSaving} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50">
                             {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />} Confirm GR
                         </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* OUTBOUND MODAL */}
      {isOutboundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsOutboundModalOpen(false)}></div>
            <div className="relative w-full max-w-2xl glass-panel bg-[#0a0a0a] rounded-3xl p-6 border border-rose-500/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 sticky top-0 bg-[#0a0a0a] z-10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><Send className="w-5 h-5 text-rose-500" /> New Material Issue</h3>
                    <button onClick={() => setIsOutboundModalOpen(false)} className="text-slate-400 hover:text-white"><X /></button>
                </div>
                <form onSubmit={handleCreateOutbound} className="space-y-5">
                    {/* Material Select */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-rose-400 uppercase mb-2 block">Select Material</label>
                                <select required value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500">
                                    <option value="">Select Material...</option>
                                    {items?.map(i => <option key={i.id} value={i.id}>{i.name} | Stock: {i.quantity}</option>)}
                                </select>
                            </div>
                            <div className="w-full md:w-32">
                                <label className="text-xs font-bold text-rose-400 uppercase mb-2 block">Qty</label>
                                <input type="number" min="1" required value={txQty} onChange={e => setTxQty(parseInt(e.target.value))} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-bold focus:border-rose-500" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2"><FileText className="w-3 h-3" /> Issue Number</label>
                            <input type="text" required value={outFormData.issueNumber} onChange={e => setOutFormData({...outFormData, issueNumber: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500 font-mono" placeholder="ISS-2024-..." />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2"><Hash className="w-3 h-3" /> WBS Element</label>
                            <input type="text" value={outFormData.wbs} onChange={e => setOutFormData({...outFormData, wbs: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500 font-mono" />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2"><CreditCard className="w-3 h-3" /> GL Account</label>
                            <input type="text" value={outFormData.glAccount} onChange={e => setOutFormData({...outFormData, glAccount: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500" />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2"><User className="w-3 h-3" /> Receiver</label>
                            <input type="text" required value={outFormData.goodReceipt} onChange={e => setOutFormData({...outFormData, goodReceipt: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Remarks</label>
                        <textarea value={outFormData.remarks} onChange={e => setOutFormData({...outFormData, remarks: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500 h-20 resize-none" placeholder="Notes..."></textarea>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-[#0a0a0a] pb-2">
                         <button type="button" onClick={() => setIsOutboundModalOpen(false)} className="px-6 py-3 rounded-xl text-slate-400 hover:text-white font-bold">Cancel</button>
                         <button type="submit" disabled={isSaving} className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50">
                             {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />} Confirm Issue
                         </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};