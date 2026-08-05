import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        toast({ title: "Logged in successfully" });
        setLocation("/gallery");
      },
      onError: (error: any) => {
        toast({
          title: "Login failed",
          description: error.response?.data?.error || "Invalid credentials",
          variant: "destructive"
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { username, password } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600 tracking-tight pb-1">Private Cloud</h1>
            <p className="mt-2 text-sm text-gray-600 font-medium">Sign in to your vibrant media vault</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none bg-white/50"
                placeholder="admin"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none bg-white/50"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loginMutation.isPending}
              className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 transform transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : "Get Started"}
            </button>
          </form>
        </div>
        <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100/50 text-center">
          <p className="text-sm font-medium text-purple-600/70">Secure & encrypted cloud storage</p>
        </div>
      </div>
    </div>
  );
}
