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
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
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

  // ✅ ref do input file (pra limpar sem TS error)
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const profitPreview = useMemo(() => {
    const sp = Number(salePrice || 0);
    const uc = Number(unitCost || 0);
    return sp - uc;
  }, [salePrice, unitCost]);

  const load = async () => {
    setLoading(true);
    const qy = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list: ProductRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const clearPhotoInput = () => {
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSalePrice("");
    setUnitCost("");
    setActive(true);
    setPhotoFile(null);
    clearPhotoInput();
  };

  const startEdit = (p: ProductRow) => {
    setEditingId(p.id);
    setName(p.name || "");
    setSalePrice(String(p.salePrice ?? ""));
    setUnitCost(String(p.unitCost ?? ""));
    setActive(!!p.active);
    setPhotoFile(null);
    clearPhotoInput();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadPhotoIfAny = async (): Promise<string | null> => {
    if (!photoFile) return null;

    const ext = photoFile.name.split(".").pop() || "jpg";
    const path = `products/${uuidv4()}.${ext}`;
    const r = storageRef(storage, path);

    await uploadBytes(r, photoFile, { contentType: photoFile.type });
    const url = await getDownloadURL(r);
    return url;
  };

  const save = async () => {
    if (!name.trim()) return alert("Nome do produto é obrigatório.");

    const sp = Number(salePrice);
    const uc = Number(unitCost);

    if (!Number.isFinite(sp) || sp <= 0) return alert("Preço de venda inválido.");
    if (!Number.isFinite(uc) || uc < 0) return alert("Custo unitário inválido.");

    setBusy(true);
    try {
      const photoUrl = await uploadPhotoIfAny();

      if (editingId) {
        const payload: any = {
          name: name.trim(),
          salePrice: sp,
          unitCost: uc,
          active,
          updatedAt: serverTimestamp(),
        };
        if (photoUrl) payload.photos = [photoUrl];
        await updateDoc(doc(db, "products", editingId), payload);
      } else {
        await addDoc(collection(db, "products"), {
          name: name.trim(),
          salePrice: sp,
          unitCost: uc,
          active,
          photos: photoUrl ? [photoUrl] : [],
          createdAt: serverTimestamp(),
        });
      }

      await load();
      resetForm();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar produto");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      await load();
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir");
    }
  };

  return (
    <AdminGuard>
      <div className="bg-app text-app min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="text-2xl font-bold text-app">Produtos</h1>
          <p className="mt-1 text-sm text-muted">
            Cadastre produtos com <b className="text-app">preço de venda</b> e{" "}
            <b className="text-app">custo unitário da matéria-prima</b>.
          </p>

          {/* FORM */}
          <div className="mt-6 rounded-2xl border border-app bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-app">{editingId ? "Editar produto" : "Novo produto"}</div>
              {editingId ? (
                <button onClick={resetForm} className="btn-ghost rounded-xl px-3 py-2 text-sm">
                  Cancelar
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-app">
                Nome
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input mt-1 w-full rounded-xl px-3 py-2"
                />
              </label>

              <label className="text-sm text-app">
                Status
                <select
                  value={active ? "active" : "inactive"}
                  onChange={(e) => setActive(e.target.value === "active")}
                  className="input mt-1 w-full rounded-xl px-3 py-2"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>

              <label className="text-sm text-app">
                Preço de venda (¥)
                <input
                  inputMode="numeric"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value.replace(/[^\d]/g, ""))}
                  className="input mt-1 w-full rounded-xl px-3 py-2"
                  placeholder="ex: 1200"
                />
              </label>

              <label className="text-sm text-app">
                Custo unitário (¥)
                <input
                  inputMode="numeric"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value.replace(/[^\d]/g, ""))}
                  className="input mt-1 w-full rounded-xl px-3 py-2"
                  placeholder="ex: 350"
                />
              </label>

              <label className="text-sm text-app sm:col-span-2">
                Foto do produto (opcional)
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="input mt-1 w-full rounded-xl px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-app bg-card-muted p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Lucro estimado por unidade</span>
                <b className={profitPreview >= 0 ? "text-[rgb(var(--primary))]" : "text-[rgb(var(--danger))]"}>
                  {yen(profitPreview)}
                </b>
              </div>
              <div className="mt-1 text-xs text-muted">Considera apenas custo unitário da matéria-prima.</div>
            </div>

            <button
              disabled={busy}
              onClick={save}
              className="mt-4 rounded-xl bg-[rgb(var(--primary))] px-4 py-2 text-sm font-semibold text-[rgb(var(--panel2))] hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar produto"}
            </button>
          </div>

          {/* LIST */}
          <div className="mt-6">
            <div className="text-sm text-muted">{loading ? "Carregando…" : `${items.length} produto(s)`}</div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <div key={p.id} className="rounded-2xl border border-app bg-card p-4 shadow-sm">
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-card-muted border border-app">
                    {p.photos?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photos[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">Sem foto</div>
                    )}
                  </div>

                  <div className="mt-3 font-semibold text-app">{p.name}</div>

                  <div className="mt-1 text-sm text-muted">
                    Venda: <b className="text-app">{yen(p.salePrice)}</b>
                  </div>
                  <div className="text-sm text-muted">
                    Custo: <b className="text-app">{yen(p.unitCost)}</b>
                  </div>
                  <div className="text-sm text-muted">
                    Lucro:{" "}
                    <b
                      className={
                        (p.salePrice || 0) - (p.unitCost || 0) >= 0
                          ? "text-[rgb(var(--primary))]"
                          : "text-[rgb(var(--danger))]"
                      }
                    >
                      {yen((p.salePrice || 0) - (p.unitCost || 0))}
                    </b>
                  </div>

                  <div className="mt-2 text-xs text-muted">
                    Status:{" "}
                    <b className={p.active ? "text-[rgb(var(--primary))]" : "text-muted"}>
                      {p.active ? "Ativo" : "Inativo"}
                    </b>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button onClick={() => startEdit(p)} className="btn-ghost flex-1 rounded-xl px-3 py-2 text-sm">
                      Editar
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="rounded-xl border border-[rgb(var(--danger))] bg-[rgb(var(--danger))/0.06] px-3 py-2 text-sm text-[rgb(var(--danger))] hover:brightness-110"
                    >
                      Excluir (somente doc)
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
