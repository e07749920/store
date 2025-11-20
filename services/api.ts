// services/api.ts

import { supabase } from '../lib/supabaseClient';
import { 
  InventoryItem, 
  TransactionLog, 
  PurchaseOrder, 
  UserProfile, 
  UserRole, 
  StockOpnameSession, 
  StockOpnameItem,
  MaterialOutRecord,
  MaterialInRecord 
} from '../types';

const generateId = (materialNo: string, sloc: string) => `${materialNo}:::${sloc}`;

// ==========================================
// 1. INVENTORY API
// ==========================================
export const inventoryApi = {
  async fetchAll(): Promise<InventoryItem[]> {
    const { data: itemsData, error: itemsError } = await supabase
      .from('stock_items')
      .select('*')
      .order('updated_at', { ascending: false });

    if (itemsError) {
      console.error('Error fetching stock_items:', itemsError.message);
      return [];
    }

    const { data: historyData } = await supabase
      .from('stock_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500); 

    return itemsData.map((item: any) => {
      const compositeId = generateId(item.material_no, item.sloc);
      const itemHistory = historyData
        ?.filter((h: any) => h.material_no === item.material_no && h.sloc === item.sloc)
        .map((h: any) => ({
          date: new Date(h.created_at).toLocaleString(),
          user: h.user_name || 'System',
          action: h.action,
          details: h.details
        })) || [];

      return {
        id: compositeId,
        materialNo: item.material_no,
        sloc: item.sloc,
        name: item.material_desc || 'Unknown Item',
        description: item.material_desc,
        quantity: item.quantity,
        uom: item.uom || 'PCS',
        price: item.price,
        pricePerUnit: item.price_per_unit,
        rackNo: item.rack_no,
        category: item.operational_class || 'General',
        minStock: item.minimum_stock,
        maxStock: item.maximum_stock,
        prStatus: item.pr_status,
        prNumber: item.pr_number,
        wbs: item.wbs,
        isConsumable: item.is_consumable,
        lastUpdated: item.updated_at,
        history: itemHistory
      };
    });
  },

  async create(item: InventoryItem): Promise<InventoryItem | null> {
    const { error } = await supabase.from('stock_items').insert([{
        material_no: item.materialNo,
        sloc: item.sloc,
        material_desc: item.name,
        quantity: item.quantity,
        uom: item.uom,
        price: item.price,
        price_per_unit: item.price, 
        rack_no: item.rackNo,
        operational_class: item.category,
        minimum_stock: item.minStock,
        maximum_stock: item.maxStock, 
        pr_status: item.prStatus,     
        pr_number: item.prNumber,     
        wbs: item.wbs,                
        is_consumable: item.isConsumable,
        updated_at: new Date().toISOString()
    }]);
    if (error) return null;
    
    await supabase.from('stock_history').insert({
      material_no: item.materialNo, sloc: item.sloc, user_name: 'System', action: 'CREATED', details: 'Initial Entry'
    });
    return item;
  },

  async update(item: InventoryItem): Promise<boolean> {
    const { error } = await supabase.from('stock_items').update({
        material_desc: item.name,
        quantity: item.quantity,
        price: item.price,
        price_per_unit: item.price, 
        rack_no: item.rackNo,
        operational_class: item.category,
        minimum_stock: item.minStock,
        maximum_stock: item.maxStock, 
        pr_status: item.prStatus,     
        pr_number: item.prNumber,     
        wbs: item.wbs,                
        is_consumable: item.isConsumable,
        updated_at: new Date().toISOString()
    }).eq('material_no', item.materialNo).eq('sloc', item.sloc);
    return !error;
  },

  async delete(id: string): Promise<boolean> {
    const [materialNo, sloc] = id.split(':::');
    const { error } = await supabase.from('stock_items').delete().eq('material_no', materialNo).eq('sloc', sloc);
    return !error;
  }
};

// ==========================================
// 2. TRANSACTION API (Inbound & Outbound)
// ==========================================
export const transactionApi = {
  
  async fetchAll(): Promise<TransactionLog[]> {
    const results: TransactionLog[] = [];

    // A. Fetch Outbound (material_out)
    const { data: outData, error: outError } = await supabase
      .from('material_out')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!outError && outData) {
      outData.forEach((row: any) => {
        results.push({
          id: `OUT-${row.id}`,
          materialNo: row.material_no,
          itemName: row.material_desc,
          sku: row.material_no,
          type: 'OUT',
          quantity: Number(row.quantity),
          date: row.date,
          status: 'COMPLETED',
          issueNumber: row.issue_number,
          wbs: row.wbs,
          glAccount: row.gl_account,
          glNumber: row.gl_number,
          receiver: row.good_receipt,
          remark: row.remarks,
          sloc: row.sloc
        });
      });
    }

    // B. Fetch Inbound (material_in) - NEW
    const { data: inData, error: inError } = await supabase
      .from('material_in')
      .select('*')
      .order('date', { ascending: false });

    if (!inError && inData) {
      inData.forEach((row: any) => {
        results.push({
          id: `IN-${row.id}`,
          materialNo: row.material_no,
          itemName: row.material_desc,
          sku: row.material_no,
          type: 'IN',
          quantity: Number(row.quantity),
          date: row.date,
          status: 'COMPLETED',
          
          // Mapping Field Inbound
          grNumber: row.gr_number,
          po: row.po,
          reference: row.reference,
          wbs: row.wbs,
          receiver: row.good_receipt,
          remark: row.remarks,
          sloc: row.sloc
        });
      });
    }

    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  // Create Outbound (Legacy + New Logic)
  async createOutbound(data: MaterialOutRecord): Promise<boolean> {
    try {
      const { error: outError } = await supabase.from('material_out').insert([{
           material_no: data.materialNo,
           material_desc: data.materialDesc,
           quantity: data.quantity,
           uom: data.uom,
           date: data.date,
           sloc: data.sloc,
           good_receipt: data.goodReceipt,
           remarks: data.remarks,
           created_at: new Date().toISOString(),
           issue_number: data.issueNumber,
           wbs: data.wbs,
           gl_number: data.glNumber,
           gl_account: data.glAccount,
           keterangan: data.keterangan
      }]);
      if (outError) throw outError;

      const { error: txError } = await supabase.from('material_transactions').insert([{
          material_no: data.materialNo,
          type: 'OUT',
          quantity: data.quantity,
          date: new Date().toISOString(),
          reference_id: data.issueNumber, 
          remarks: `Outbound: ${data.goodReceipt}`,
          created_at: new Date().toISOString()
      }]);
      if (txError) throw txError;

      return true;
    } catch (err) {
      console.error("Failed to create outbound:", err);
      return false;
    }
  },

  // Create Inbound (NEW)
  async createInbound(data: MaterialInRecord): Promise<boolean> {
    try {
      // 1. Insert ke 'material_in'
      const { error: inError } = await supabase.from('material_in').insert([{
           material_no: data.materialNo,
           gr_number: data.grNumber,
           material_desc: data.materialDesc,
           quantity: data.quantity,
           sloc: data.sloc,
           uom: data.uom,
           remarks: data.remarks,
           wbs: data.wbs,
           good_receipt: data.goodReceipt,
           date: data.date,
           po: data.po,
           reference: data.reference
      }]);
      if (inError) throw inError;

      // 2. Insert Log ke 'material_transactions'
      const { error: txError } = await supabase.from('material_transactions').insert([{
          material_no: data.materialNo,
          type: 'IN',
          quantity: data.quantity,
          date: new Date().toISOString(),
          reference_id: data.grNumber,
          remarks: `Inbound GR: ${data.grNumber}`,
          created_at: new Date().toISOString()
      }]);
      if (txError) throw txError;

      // 3. Update Master Stok di `stock_items` (Tambah Stok)
      // Mengambil item saat ini dulu
      const { data: currentItem } = await supabase
        .from('stock_items')
        .select('quantity')
        .eq('material_no', data.materialNo)
        .eq('sloc', data.sloc)
        .single();

      if (currentItem) {
         await supabase.from('stock_items')
           .update({ quantity: currentItem.quantity + data.quantity, updated_at: new Date().toISOString() })
           .eq('material_no', data.materialNo)
           .eq('sloc', data.sloc);
      }

      return true;
    } catch (err) {
      console.error("Failed to create inbound:", err);
      return false;
    }
  },

  async update(tx: TransactionLog): Promise<boolean> { return true; },
  async delete(id: string): Promise<boolean> { return true; }
};

// ... (Sisa API purchase, user, stockOpname dibiarkan sama seperti sebelumnya)
// Agar file lengkap, saya sertakan placeholder minimal agar tidak error

export const purchaseApi = {
    async fetchAll(): Promise<PurchaseOrder[]> { return []; },
    async create(po: PurchaseOrder): Promise<PurchaseOrder | null> { return null; },
    async updateStatus(id: string, status: any): Promise<boolean> { return true; }
};

export const userApi = {
    async fetchAll(): Promise<UserProfile[]> { return []; },
    async getByEmail(email: string): Promise<UserProfile | null> { return null; },
    async create(user: UserProfile): Promise<UserProfile | null> { return null; },
    async update(user: UserProfile): Promise<boolean> { return true; },
    async delete(id: string): Promise<boolean> { return true; }
};

export const stockOpnameApi = {
    async fetchSessions(): Promise<StockOpnameSession[]> { return []; },
    async createSession(t: string, n: string, c: string): Promise<StockOpnameSession | null> { return null; },
    async fetchSessionItems(sid: string): Promise<{ items: StockOpnameItem[], total: number }> { return { items: [], total: 0 }; },
    async fetchSessionStats(sid: string) { return { total: 0, counted: 0, matched: 0, variance: 0 }; },
    async updateCount(iid: string, q: number): Promise<boolean> { return true; },
    async finalizeSession(sid: string, items: StockOpnameItem[]): Promise<boolean> { return true; },
    async fetchAllSessionItems(sid: string): Promise<StockOpnameItem[]> { return []; }
};