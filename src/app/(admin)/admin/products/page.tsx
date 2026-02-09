"use client";

import AdminGuard from "@/components/AdminGuard";
import Navbar from "@/components/Navbar";
import { db, storage } from "@/lib/firebaseClient";
import { yen } from "@/lib/money";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { 
  getDownloadURL, 
  ref as storageRef, 
  uploadBytes, 
  deleteObject 
} from "firebase/storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

type ProductRow = {
  id: string;
  name: string;
  salePrice: number;
  unitCost: number;
  photos: string[];
  active: boolean;
  createdAt?: any;
};

export default function AdminProductsPage() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [active, setActive] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const profitPreview = useMemo(() => {
    const sp = Number(salePrice || 0);
    const uc = Number(unitCost || 0);
    return sp - uc;
  }, [salePrice, unitCost]);

  const load = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qy);
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSalePrice("");
    setUnitCost("");
    setActive(true);
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const startEdit = (p: ProductRow) => {
    setEditingId(p.id);
    setName(p.name || "");
    setSalePrice(String(p.salePrice ?? ""));
    setUnitCost(String(p.unitCost ?? ""));
    setActive(!!p.active);
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadPhotoIfAny = async (): Promise<string | null> => {
    if (!photoFile) return null;
    const ext = photoFile.name.split(".").pop() || "jpg";
    const path = `products/${uuidv4()}.${ext}`;
    const r = storageRef(storage, path);
    await uploadBytes(r, photoFile, { contentType: photoFile.type });
    return await getDownloadURL(r);
  };

  const save = async () => {
    if (!name.trim()) return alert("Nome é obrigatório.");
    setBusy(true);

    try {
      const photoUrl = await uploadPhotoIfAny();
      const payload: any = {
        name: name.trim(),
        salePrice: Number(salePrice),
        unitCost: Number(unitCost),
        active,
        updatedAt: serverTimestamp(),
      };

      if (photoUrl) payload.photos = [photoUrl];

      if (editingId) {
        await updateDoc(doc(db, "products", editingId), payload);
      } else {
        await addDoc(collection(db, "products"), {
          ...payload,
          photos: photoUrl ? [photoUrl] : [],
          createdAt: serverTimestamp(),
        });
      }

      await load();
      resetForm();
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // ✅ NÍVEL PROFISSIONAL: Exclusão com limpeza de Storage
  const remove = async (product: ProductRow) => {
    const confirmMsg = product.photos?.length 
      ? "Excluir este produto e TODAS as fotos associadas?" 
      : "Excluir este produto?";
    
    if (!confirm(confirmMsg)) return;

    setBusy(true);
    try {
      // 1. Limpeza de Imagens no Storage
      if (product.photos && product.photos.length > 0) {
        for (const url of product.photos) {
          try {
            // Extrai a referência do Storage a partir da URL
            const imageRef = storageRef(storage, url);
            await deleteObject(imageRef);
          } catch (storageErr) {
            console.warn("Aviso: Imagem não encontrada no Storage ou já deletada.");
          }
        }
      }

      // 2. Exclusão do Documento
      await deleteDoc(doc(db, "products", product.id));
      
      await load();
    } catch (e: any) {
      alert("Erro ao excluir: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGuard>
      <div className="bg-app text-app min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="text-2xl font-bold text-app">Produtos</h1>

          {/* FORMULÁRIO */}
          <div className="mt-6 rounded-2xl border border-app bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{editingId ? "Editar Produto" : "Novo Produto"}</h2>
              {editingId && <button onClick={resetForm} className="text-xs text-muted underline">Cancelar</button>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do produto" className="input rounded-xl px-3 py-2" />
              <select value={active ? "active" : "inactive"} onChange={e => setActive(e.target.value === "active")} className="input rounded-xl px-3 py-2">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
              <input 
  value={salePrice} 
  onChange={e => setSalePrice(e.target.value.replace(/\D/g,""))} 
  placeholder="Preço de venda (¥)" 
  className="input rounded-xl px-3 py-2"
  // Adicione estes dois abaixo:
  inputMode="numeric" 
  pattern="[0-9]*"
/>

<input 
  value={unitCost} 
  onChange={e => setUnitCost(e.target.value.replace(/\D/g,""))} 
  placeholder="Custo unitário (¥)" 
  className="input rounded-xl px-3 py-2"
  // Adicione estes dois abaixo:
  inputMode="numeric" 
  pattern="[0-9]*"
/><div className="sm:col-span-2">
                <p className="text-xs text-muted mb-1">Foto do produto</p>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="input w-full rounded-xl px-3 py-2" />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-card-muted flex justify-between items-center">
              <span className="text-sm text-muted">Lucro unitário:</span>
              <b className={profitPreview >= 0 ? "text-[rgb(var(--primary))]" : "text-[rgb(var(--danger))]"}>{yen(profitPreview)}</b>
            </div>

            <button disabled={busy} onClick={save} className="btn-primary mt-4 w-full rounded-xl py-2 font-semibold disabled:opacity-50">
              {busy ? "Processando..." : editingId ? "Atualizar Produto" : "Cadastrar Produto"}
            </button>
          </div>

          {/* LISTA */}
          <div className="mt-8">
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-sm text-muted font-medium">{loading ? "Carregando..." : `${items.length} produtos cadastrados`}</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <div key={p.id} className={`rounded-2xl border border-app bg-card p-4 transition-opacity ${!p.active ? 'opacity-60' : ''}`}>
                  <div className="aspect-square rounded-xl bg-card-muted overflow-hidden border border-app mb-3">
                    {p.photos?.[0] ? (
                      <img src={p.photos[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted">Sem imagem</div>
                    )}
                  </div>

                  <h3 className="font-bold truncate">{p.name}</h3>
                  <div className="text-sm mt-2 flex justify-between">
                    <span className="text-muted">Venda:</span>
                    <span className="font-semibold">{yen(p.salePrice)}</span>
                  </div>
                  <div className="text-sm flex justify-between">
                    <span className="text-muted">Custo:</span>
                    <span>{yen(p.unitCost)}</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button onClick={() => startEdit(p)} className="btn-ghost flex-1 py-1.5 rounded-lg text-sm">Editar</button>
                    <button 
                      disabled={busy} 
                      onClick={() => remove(p)} 
                      className="border border-[rgb(var(--danger))] text-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.05] px-3 py-1.5 rounded-lg text-sm hover:bg-[rgb(var(--danger))/0.1]"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}