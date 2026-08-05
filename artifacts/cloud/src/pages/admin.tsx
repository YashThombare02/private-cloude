import { useState } from "react";
import { 
  useListUsers, 
  useCreateUser, 
  useDeleteUser,
  useGetCurrentUser
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: users, refetch: refetchUsers } = useListUsers();
  const { data: currentUser } = useGetCurrentUser();
  const { toast } = useToast();
  
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    
    try {
      await createUser.mutateAsync({
        data: { username: newUsername, password: newPassword, role: newRole as any }
      });
      toast({ title: "✅ User created successfully" });
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      setIsCreating(false);
      refetchUsers();
    } catch (err: any) {
      toast({ 
        title: "❌ Failed to create user", 
        description: err.response?.data?.error || err.message,
        variant: "destructive" 
      });
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (id === currentUser?.id) {
      toast({ title: "Cannot delete your own account", variant: "destructive" });
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }
    
    try {
      await deleteUser.mutateAsync({ id });
      toast({ title: `🗑️ User "${username}" deleted` });
      refetchUsers();
    } catch (err: any) {
      toast({ 
        title: "❌ Failed to delete user", 
        description: err.response?.data?.error || err.message,
        variant: "destructive" 
      });
    }
  };

  const grad = "linear-gradient(135deg,#6366f1,#ec4899)";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f0f0ff 0%,#faf0ff 50%,#fff0f8 100%)", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        .admin-btn { transition: transform 0.15s, box-shadow 0.15s; cursor: pointer; }
        .admin-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(236,72,153,0.3); }
        .del-btn { transition: background 0.15s, color 0.15s; }
        .del-btn:hover { background: #fee2e2; color: #b91c1c; }
        .input-field { transition: border-color 0.15s, box-shadow 0.15s; }
        .input-field:focus { outline: none; border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.2); }
      `}</style>

      {/* HEADER */}
      <header style={{ position:"sticky", top:0, zIndex:40, background:"rgba(255,255,255,0.88)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(139,92,246,0.15)", boxShadow:"0 1px 20px rgba(139,92,246,0.08)" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 24px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:14, background:grad, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(236,72,153,0.4)", cursor:"pointer" }} onClick={() => setLocation("/gallery")}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span onClick={() => setLocation("/gallery")} style={{ fontWeight:800, fontSize:18, background:grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", cursor:"pointer" }}>Admin Dashboard</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 24px", display: "flex", flexDirection: "col", gap: 30 }}>
        
        {/* USERS MANAGEMENT */}
        <div style={{ background: "white", borderRadius: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.04)", border: "1px solid rgba(139,92,246,0.1)", overflow: "hidden" }}>
          
          <div style={{ padding: "24px 30px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fbfbfe" }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1f2937", margin: 0 }}>User Management</h2>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0 0" }}>Create, delete, and manage access to the cloud.</p>
            </div>
            <button 
              onClick={() => setIsCreating(!isCreating)}
              className="admin-btn"
              style={{ background: isCreating ? "#ef4444" : grad, color: "white", border: "none", padding: "10px 20px", borderRadius: 50, fontWeight: 700, fontSize: 14 }}
            >
              {isCreating ? "Cancel" : "+ New User"}
            </button>
          </div>

          {isCreating && (
            <div style={{ padding: "24px 30px", background: "rgba(139,92,246,0.03)", borderBottom: "1px solid rgba(139,92,246,0.1)" }}>
              <form onSubmit={handleCreateUser} style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Username</label>
                  <input required minLength={3} type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="input-field" placeholder="e.g. johndoe" style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Password</label>
                  <input required minLength={8} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
                </div>
                <div style={{ width: 140 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} className="input-field" style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", boxSizing: "border-box" }}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" disabled={createUser.isPending} className="admin-btn" style={{ background: "#111827", color: "white", border: "none", padding: "12px 28px", borderRadius: 12, fontWeight: 700, height: 43, opacity: createUser.isPending ? 0.6 : 1 }}>
                  {createUser.isPending ? "Creating..." : "Create"}
                </button>
              </form>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead style={{ background: "rgba(0,0,0,0.02)" }}>
                <tr>
                  <th style={{ padding: "16px 30px", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>Username</th>
                  <th style={{ padding: "16px", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>Role</th>
                  <th style={{ padding: "16px", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>Status</th>
                  <th style={{ padding: "16px", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>Created</th>
                  <th style={{ padding: "16px 30px", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid rgba(0,0,0,0.05)", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user: any) => (
                  <tr key={user.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.03)", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.01)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: "20px 30px", fontWeight: 600, color: "#374151" }}>
                      {user.username}
                      {currentUser?.id === user.id && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>(You)</span>}
                    </td>
                    <td style={{ padding: "20px 16px" }}>
                      <span style={{ 
                        padding: "4px 10px", 
                        borderRadius: 50, 
                        fontSize: 11, 
                        fontWeight: 800, 
                        background: user.role === 'admin' ? '#f3e8ff' : '#dbeafe', 
                        color: user.role === 'admin' ? '#7e22ce' : '#1d4ed8' 
                      }}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "20px 16px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: user.isActive ? '#059669' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: user.isActive ? '#10b981' : '#ef4444' }} />
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: "20px 16px", color: "#6b7280", fontSize: 13 }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "20px 30px", textAlign: "right" }}>
                      {currentUser?.id !== user.id && (
                        <button 
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          disabled={deleteUser.isPending}
                          className="del-btn"
                          style={{ 
                            background: "transparent", 
                            color: "#ef4444", 
                            border: "none", 
                            padding: "6px 12px", 
                            borderRadius: 8, 
                            fontWeight: 600, 
                            fontSize: 13, 
                            cursor: "pointer",
                            opacity: deleteUser.isPending ? 0.5 : 1
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
