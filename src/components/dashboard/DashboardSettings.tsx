import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

const DashboardSettings = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const username = profile?.discord_username || "your account";

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Please type DELETE to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Delete user's servers first
      const { error: serversError } = await supabase
        .from("user_servers")
        .delete()
        .eq("user_id", user?.id);

      if (serversError) {
        console.error("Error deleting servers:", serversError);
      }

      // Delete user's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user?.id);

      if (profileError) {
        console.error("Error deleting profile:", profileError);
        throw profileError;
      }

      // Sign out the user
      await signOut();

      toast({
        title: "Account deleted",
        description: "Your account has been successfully deleted.",
      });

      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: "Failed to delete your account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Account Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Account</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">Discord Username</p>
              <p className="text-sm text-muted-foreground">{username}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">Discord ID</p>
              <p className="text-sm text-muted-foreground">{profile?.discord_id || "N/A"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-destructive/50">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          Once you delete your account, there is no going back. This will permanently delete your 
          profile, server connections, and all associated data.
        </p>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="w-4 h-4" />
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete your account 
                  and remove all your data from our servers.
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm:
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="font-mono"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={confirmText !== "DELETE" || isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Account"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
};

export default DashboardSettings;
