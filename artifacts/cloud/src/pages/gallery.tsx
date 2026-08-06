import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListMedia,
  useRequestMediaUploadUrl,
  useCreateMedia,
  useGetCurrentUser,
  useDeleteMedia,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type MediaItem = {
  id: number;
  originalFilename: string;
  mediaType: string;
  mimeType: string;
  size: number;
  folderName?: string | null;
};

type ViewState =
  | { kind: "all" }
  | { kind: "folder"; name: string };

/* ── style helpers ── */
const grad = "linear-gradient(135deg,#6366f1,#ec4899)";
const gradFolder = "linear-gradient(135deg,#8b5cf6,#06b6d4)";

export default function Gallery() {
  const { data: media, isLoading, refetch } = useListMedia();
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetCurrentUser();
  const requestUrlMutation = useRequestMediaUploadUrl();
  const createMediaMutation = useCreateMedia();
  const deleteMediaMutation = useDeleteMedia();
  const { toast } = useToast();

  const [view, setView] = useState<ViewState>({ kind: "all" });
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; done: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<string | null>(null);

  const isAdmin = (currentUser as any)?.role === "admin";
  const allItems: MediaItem[] = (media as any)?.items ?? [];

  /* ── folder grouping ── */
  const folders = Array.from(
    new Set(allItems.filter(i => i.folderName).map(i => i.folderName!))
  ).sort();
  const standalone = allItems.filter(i => !i.folderName);

  /* current view items */
  const currentItems =
    view.kind === "folder"
      ? allItems.filter(i => i.folderName === view.name)
      : standalone;

  /* ── upload one file ── */
  const uploadFile = async (file: File, folderName?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (folderName) {
      formData.append("folderName", folderName);
    }

    console.log("[DEBUG] POSTing to /api/media/upload/direct with file:", file.name);
    
    const uploadRes = await fetch("/api/media/upload/direct", {
      method: "POST",
      body: formData,
      credentials: "include",
    }).catch(err => {
      alert("Network Error: " + err.message);
      throw err;
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      alert("Upload Failed: " + (err.error || uploadRes.statusText));
      throw new Error(err.error || "Failed to save file");
    }
  };

  /* ── handle file input ── */
  const handleFiles = async (fileList: FileList | null, isFolder = false) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter(
      f => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (files.length === 0) {
      toast({ title: "No supported files", variant: "destructive" });
      return;
    }

    /* derive folder name from webkitRelativePath e.g. "MyTrip/photo.jpg" → "MyTrip" */
    let folderName: string | undefined;
    if (isFolder) {
      if (files[0].webkitRelativePath) {
        folderName = files[0].webkitRelativePath.split("/")[0];
      }
      if (!folderName) {
        folderName = window.prompt("Enter a name for this folder:", "New Folder") || "New Folder";
      }
    }

    setUploading(true);
    setUploadQueue(files.map(f => ({ name: f.name, done: false })));
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        await uploadFile(files[i], folderName);
        setUploadQueue(q => q.map((item, idx) => idx === i ? { ...item, done: true } : item));
      } catch {
        failed++;
        setUploadQueue(q => q.map((item, idx) => idx === i ? { ...item, done: true } : item));
      }
    }

    setUploading(false);
    setUploadQueue([]);
    await refetch();

    if (failed === 0) {
      if (folderName) {
        toast({ title: `📁 Folder "${folderName}" uploaded!`, description: `${files.length} files saved` });
        setView({ kind: "folder", name: folderName });
      } else {
        toast({ title: `✅ ${files.length} file${files.length > 1 ? "s" : ""} uploaded!` });
      }
    } else {
      toast({ title: `⚠️ ${files.length - failed} uploaded, ${failed} failed`, variant: "destructive" });
    }
  };

  /* ── delete ── */
  const handleDelete = async (id: number) => {
    try {
      await deleteMediaMutation.mutateAsync({ id });
      toast({ title: "🗑️ Deleted" });
      if (lightbox?.id === id) setLightbox(null);
      refetch();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
    setDeleteConfirm(null);
  };

  const handleDeleteFolder = async (folderName: string) => {
    try {
      const res = await fetch(`/api/media/folder/${encodeURIComponent(folderName)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete folder failed");
      toast({ title: `🗑️ Folder "${folderName}" deleted` });
      if (view.kind === "folder" && view.name === folderName) {
        setView({ kind: "all" });
      }
      refetch();
    } catch {
      toast({ title: "Delete folder failed", variant: "destructive" });
    }
    setDeleteFolderConfirm(null);
  };

  /* ── render ── */
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f0f0ff 0%,#faf0ff 50%,#fff0f8 100%)" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .mc:hover { transform:translateY(-4px)!important; box-shadow:0 16px 40px rgba(139,92,246,0.22)!important; }
        .mc:hover .ov { opacity:1!important; }
        .mc:hover img { transform:scale(1.06); }
        .fc:hover { transform:translateY(-4px)!important; box-shadow:0 16px 40px rgba(8,145,178,0.22)!important; }
        .del-btn:hover { background:rgba(239,68,68,0.85)!important; }
        .up-btn:hover { transform:translateY(-2px); }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ position:"sticky", top:0, zIndex:40, background:"rgba(255,255,255,0.88)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(139,92,246,0.15)", boxShadow:"0 1px 20px rgba(139,92,246,0.08)" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 24px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between" }}>

          {/* Brand + breadcrumb */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:14, background:grad, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(236,72,153,0.4)", cursor:"pointer" }} onClick={() => setView({ kind:"all" })}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span onClick={() => setView({ kind:"all" })} style={{ fontWeight:800, fontSize:18, background:grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", cursor:"pointer" }}>My Cloud</span>
                {view.kind === "folder" && (
                  <>
                    <span style={{ color:"#d1d5db", fontSize:18 }}>/</span>
                    <span style={{ fontWeight:700, fontSize:16, background:gradFolder, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>📁 {view.name}</span>
                  </>
                )}
              </div>
              <div style={{ fontSize:11, color:"#a78bfa", fontWeight:600, marginTop:-2 }}>
                {view.kind === "all"
                  ? `${standalone.length} file${standalone.length !== 1 ? "s" : ""}${folders.length > 0 ? ` · ${folders.length} folder${folders.length !== 1 ? "s" : ""}` : ""}`
                  : `${currentItems.length} file${currentItems.length !== 1 ? "s" : ""} in folder`}
              </div>
            </div>
          </div>

          {/* Admin badge */}
          {isAdmin && (
            <div 
              onClick={() => setLocation("/admin")}
              style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"white", fontSize:11, fontWeight:800, padding:"4px 12px", borderRadius:50, boxShadow:"0 2px 8px rgba(239,68,68,0.3)", cursor:"pointer", transition:"transform 0.15s" }}
              className="up-btn"
              title="Manage Users"
            >
              👑 ADMIN
            </div>
          )}

          {/* Buttons */}
          {isAdmin && (
            <div style={{ display:"flex", gap:10 }}>
              <label className="up-btn" style={{ display:"flex", alignItems:"center", gap:8, cursor:uploading?"not-allowed":"pointer", background:grad, color:"white", fontWeight:700, fontSize:13, padding:"10px 18px", borderRadius:50, boxShadow:"0 4px 18px rgba(236,72,153,0.38)", transition:"transform 0.15s", opacity:uploading?0.7:1 }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0l-4 4m4-4l4 4" /></svg>
                Files
                <input type="file" style={{ display:"none" }} accept="image/*,video/*" multiple onChange={e => handleFiles(e.target.files, false)} disabled={uploading} />
              </label>
              <label className="up-btn" style={{ display:"flex", alignItems:"center", gap:8, cursor:uploading?"not-allowed":"pointer", background:gradFolder, color:"white", fontWeight:700, fontSize:13, padding:"10px 18px", borderRadius:50, boxShadow:"0 4px 18px rgba(8,145,178,0.38)", transition:"transform 0.15s", opacity:uploading?0.7:1 }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                Folder
                <input type="file" style={{ display:"none" }} accept="image/*,video/*"
                  {...{ webkitdirectory:"", directory:"" } as any}
                  onChange={e => handleFiles(e.target.files, true)} disabled={uploading} />
              </label>
            </div>
          )}
        </div>
      </header>

      {/* ── PROGRESS BAR ── */}
      {uploading && uploadQueue.length > 0 && (
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"16px 24px 0" }}>
          <div style={{ background:"white", borderRadius:16, padding:20, boxShadow:"0 4px 24px rgba(139,92,246,0.15)", border:"1px solid rgba(139,92,246,0.12)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ width:20, height:20, borderRadius:"50%", border:"3px solid #e9d5ff", borderTopColor:"#8b5cf6", animation:"spin 0.8s linear infinite" }} />
              <span style={{ fontWeight:700, color:"#6366f1", fontSize:14 }}>
                Uploading {uploadQueue.filter(f => f.done).length} / {uploadQueue.length} files…
              </span>
            </div>
            <div style={{ height:8, background:"#f3f4f6", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", background:grad, borderRadius:99, transition:"width 0.3s", width:`${(uploadQueue.filter(f => f.done).length / uploadQueue.length) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── BACK BUTTON (folder view) ── */}
      {view.kind === "folder" && (
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"20px 24px 0" }}>
          <button onClick={() => setView({ kind:"all" })} style={{ display:"flex", alignItems:"center", gap:8, background:"white", border:"2px solid rgba(139,92,246,0.2)", color:"#6366f1", fontWeight:700, fontSize:14, padding:"8px 20px", borderRadius:50, cursor:"pointer", boxShadow:"0 2px 10px rgba(139,92,246,0.1)" }}>
            ← Back to All
          </button>
        </div>
      )}

      {/* ── MAIN ── */}
      <main style={{ maxWidth:1280, margin:"0 auto", padding:"24px 24px 48px" }}>
        {isLoading ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:300, gap:16 }}>
            <div style={{ width:48, height:48, borderRadius:"50%", border:"4px solid #e9d5ff", borderTopColor:"#8b5cf6", animation:"spin 0.8s linear infinite" }} />
            <p style={{ color:"#a78bfa", fontWeight:600 }}>Loading your media…</p>
          </div>

        ) : allItems.length === 0 ? (
          /* Empty state */
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:24, textAlign:"center" }}>
            <div style={{ width:100, height:100, borderRadius:"50%", background:"linear-gradient(135deg,rgba(99,102,241,0.12),rgba(236,72,153,0.12))", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="50" height="50" fill="none" viewBox="0 0 24 24" stroke="#ec4899" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize:28, fontWeight:800, background:grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:0 }}>Nothing here yet</h2>
              <p style={{ color:"#9ca3af", marginTop:8, fontWeight:500 }}>Upload files or an entire folder to get started</p>
            </div>
            <label className="up-btn" style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", background:grad, color:"white", fontWeight:700, fontSize:16, padding:"14px 32px", borderRadius:16, boxShadow:"0 8px 28px rgba(236,72,153,0.4)", transition:"transform 0.15s" }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0l-4 4m4-4l4 4" /></svg>
              Upload Media
              <input type="file" style={{ display:"none" }} accept="image/*,video/*" multiple onChange={e => handleFiles(e.target.files, false)} />
            </label>
          </div>

        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:32 }}>

            {/* ── FOLDER CARDS (only in "all" view) ── */}
            {view.kind === "all" && folders.length > 0 && (
              <section>
                <h2 style={{ fontSize:16, fontWeight:800, color:"#6b7280", letterSpacing:"0.06em", textTransform:"uppercase", margin:"0 0 14px" }}>📁 Folders</h2>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:14 }}>
                  {folders.map(folderName => {
                    const folderFiles = allItems.filter(i => i.folderName === folderName);
                    const cover = folderFiles.find(f => f.mediaType === "photo") ?? folderFiles[0];
                    return (
                      <div key={folderName} className="fc" onClick={() => setView({ kind:"folder", name:folderName })}
                        style={{ borderRadius:18, overflow:"hidden", background:"white", cursor:"pointer", border:"1px solid rgba(8,145,178,0.15)", boxShadow:"0 2px 12px rgba(8,145,178,0.1)", transition:"transform 0.2s ease, box-shadow 0.2s ease" }}>
                        {/* Folder thumbnail grid */}
                        <div style={{ position:"relative", height:140, background:"linear-gradient(135deg,#e0e7ff,#cffafe)", overflow:"hidden" }}>
                          {cover && (
                            <img src={`/api/media/${cover.id}/view`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.7 }} />
                          )}
                          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,transparent 30%,rgba(8,145,178,0.5))", display:"flex", alignItems:"flex-end", padding:10 }}>
                            <span style={{ fontSize:32 }}>📁</span>
                          </div>
                          
                          <div style={{ position:"absolute", top:8, right:8, display: "flex", gap: 6 }}>
                            {isAdmin && (
                              <button onClick={e => { e.stopPropagation(); setDeleteFolderConfirm(folderName); }}
                                style={{ background:"rgba(239,68,68,0.85)", border:"1px solid rgba(255,255,255,0.25)", color:"white", width:24, height:24, borderRadius:6, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(6px)" }} title="Delete Folder">
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                            <div style={{ background:"rgba(8,145,178,0.85)", color:"white", fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:50, backdropFilter:"blur(4px)", display:"flex", alignItems:"center" }}>
                              {folderFiles.length} files
                            </div>
                          </div>
                        </div>
                        <div style={{ padding:"12px 14px" }}>
                          <p style={{ fontWeight:800, fontSize:14, color:"#0e7490", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{folderName}</p>
                          <p style={{ fontSize:11, color:"#94a3b8", margin:"3px 0 0", fontWeight:500 }}>Click to open</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── FILE GRID ── */}
            {(view.kind === "folder" || standalone.length > 0) && (
              <section>
                {view.kind === "all" && standalone.length > 0 && (
                  <h2 style={{ fontSize:16, fontWeight:800, color:"#6b7280", letterSpacing:"0.06em", textTransform:"uppercase", margin:"0 0 14px" }}>🖼️ Files</h2>
                )}
                {currentItems.length === 0 ? (
                  <p style={{ color:"#9ca3af", fontWeight:500 }}>No files here yet.</p>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(190px, 1fr))", gap:14 }}>
                    {currentItems.map(item => (
                      <div key={item.id} className="mc" style={{ aspectRatio:"1/1", borderRadius:18, overflow:"hidden", background:"#f3f4f6", cursor:"pointer", position:"relative", boxShadow:"0 2px 12px rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.12)", transition:"transform 0.2s ease, box-shadow 0.2s ease" }}>
                        {item.mediaType === "video" ? (
                          <video src={`/api/media/${item.id}/view`} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", pointerEvents:"none" }} muted preload="metadata" />
                        ) : (
                          <img src={`/api/media/${item.id}/view`} alt={item.originalFilename} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", transition:"transform 0.3s ease" }} />
                        )}
                        <div className="ov" onClick={() => setLightbox(item)} style={{ position:"absolute", inset:0, opacity:0, transition:"opacity 0.2s ease", background:"linear-gradient(to top,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.05) 55%,transparent 100%)", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:10 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            {item.mediaType === "video" ? (
                              <span style={{ background:"rgba(0,0,0,0.55)", color:"white", fontSize:10, fontWeight:800, padding:"3px 8px", borderRadius:8 }}>▶ VIDEO</span>
                            ) : <span />}
                            {isAdmin && (
                              <button className="del-btn" onClick={e => { e.stopPropagation(); setDeleteConfirm(item.id); }}
                                style={{ background:"rgba(239,68,68,0.6)", border:"1px solid rgba(255,255,255,0.25)", color:"white", width:30, height:30, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(6px)", transition:"background 0.15s" }} title="Delete">
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div>
                            <p style={{ color:"white", fontSize:11, fontWeight:600, margin:"0 0 8px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.originalFilename}</p>
                            <div style={{ display:"flex", gap:6 }}>
                              <span style={{ flex:1, textAlign:"center", fontSize:12, fontWeight:700, color:"white", background:"rgba(255,255,255,0.18)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.3)", padding:"6px 0", borderRadius:10 }}>
                                {item.mediaType === "video" ? "▶ Play" : "🔍 View"}
                              </span>
                              <a href={`/api/media/${item.id}/download`} target="_blank" onClick={e => e.stopPropagation()}
                                style={{ flex:1, textAlign:"center", fontSize:12, fontWeight:700, color:"white", background:"rgba(255,255,255,0.18)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.3)", padding:"6px 0", borderRadius:10, textDecoration:"none", display:"block" }}>
                                ⬇ Save
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm !== null && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position:"fixed", inset:0, zIndex:998, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"white", borderRadius:20, padding:32, maxWidth:380, width:"100%", textAlign:"center", boxShadow:"0 24px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ width:60, height:60, borderRadius:"50%", background:"rgba(239,68,68,0.1)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 style={{ fontSize:20, fontWeight:800, color:"#111", margin:"0 0 8px" }}>Delete this item?</h3>
            <p style={{ color:"#6b7280", marginBottom:24, fontSize:14 }}>This cannot be undone.</p>
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex:1, padding:"12px", borderRadius:12, border:"2px solid #e5e7eb", background:"white", fontWeight:700, cursor:"pointer", fontSize:14, color:"#374151" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex:1, padding:"12px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"white", fontWeight:700, cursor:"pointer", fontSize:14, boxShadow:"0 4px 14px rgba(239,68,68,0.4)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE FOLDER CONFIRM ── */}
      {deleteFolderConfirm !== null && (
        <div onClick={() => setDeleteFolderConfirm(null)} style={{ position:"fixed", inset:0, zIndex:998, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"white", borderRadius:20, padding:32, maxWidth:380, width:"100%", textAlign:"center", boxShadow:"0 24px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ width:60, height:60, borderRadius:"50%", background:"rgba(239,68,68,0.1)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <span style={{ fontSize:28 }}>📁</span>
            </div>
            <h3 style={{ fontSize:20, fontWeight:800, color:"#111", margin:"0 0 8px" }}>Delete entire folder?</h3>
            <p style={{ color:"#6b7280", marginBottom:24, fontSize:14 }}>This will permanently delete the folder <strong>"{deleteFolderConfirm}"</strong> and all its contents.</p>
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={() => setDeleteFolderConfirm(null)} style={{ flex:1, padding:"12px", borderRadius:12, border:"2px solid #e5e7eb", background:"white", fontWeight:700, cursor:"pointer", fontSize:14, color:"#374151" }}>Cancel</button>
              <button onClick={() => handleDeleteFolder(deleteFolderConfirm)} style={{ flex:1, padding:"12px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"white", fontWeight:700, cursor:"pointer", fontSize:14, boxShadow:"0 4px 14px rgba(239,68,68,0.4)" }}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} onKeyDown={e => e.key === "Escape" && setLightbox(null)} tabIndex={-1}
          style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.93)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <p style={{ position:"absolute", top:22, left:22, color:"rgba(255,255,255,0.6)", fontSize:13, fontWeight:600, maxWidth:"45%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {lightbox.folderName && <span style={{ color:"#67e8f9" }}>📁 {lightbox.folderName} / </span>}
            {lightbox.originalFilename}
          </p>
          {isAdmin && (
            <button onClick={e => { e.stopPropagation(); setDeleteConfirm(lightbox.id); }}
              style={{ position:"absolute", top:16, right:70, width:44, height:44, borderRadius:"50%", background:"rgba(239,68,68,0.6)", border:"1px solid rgba(255,255,255,0.2)", color:"white", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>
              🗑️
            </button>
          )}
          <button onClick={() => setLightbox(null)} style={{ position:"absolute", top:16, right:16, width:44, height:44, borderRadius:"50%", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.25)", color:"white", fontSize:20, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>✕</button>
          <div onClick={e => e.stopPropagation()} style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            {lightbox.mediaType === "video" ? (
              <video src={`/api/media/${lightbox.id}/view`} controls autoPlay style={{ maxWidth:"90vw", maxHeight:"82vh", borderRadius:16, boxShadow:"0 24px 80px rgba(0,0,0,0.6)" }} />
            ) : (
              <img src={`/api/media/${lightbox.id}/view`} alt={lightbox.originalFilename} style={{ maxWidth:"90vw", maxHeight:"82vh", borderRadius:16, boxShadow:"0 24px 80px rgba(0,0,0,0.6)", objectFit:"contain" }} />
            )}
          </div>
          <a href={`/api/media/${lightbox.id}/download`} target="_blank" onClick={e => e.stopPropagation()}
            style={{ position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"center", gap:8, background:grad, color:"white", fontWeight:700, fontSize:14, padding:"12px 28px", borderRadius:50, boxShadow:"0 6px 24px rgba(236,72,153,0.5)", textDecoration:"none" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download
          </a>
        </div>
      )}
    </div>
  );
}
