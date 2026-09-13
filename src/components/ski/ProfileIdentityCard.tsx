import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSkiProfile } from "@/hooks/useSkiProfile";

/** Ridimensiona l'immagine scelta a 256px e la converte in dato salvabile. */
async function toAvatarData(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Immagine non supportata");
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Foto profilo, nome utente e biografia. */
export function ProfileIdentityCard() {
  const { profile, save, saving, isAuthenticated } = useSkiProfile();
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatarUrl);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsername(profile.username);
    setBio(profile.bio);
    setAvatar(profile.avatarUrl);
  }, [profile.username, profile.bio, profile.avatarUrl]);

  const persist = async (next: { username?: string; bio?: string; avatarUrl?: string }) => {
    setMessage(null);
    try {
      await save(next);
      setMessage("Profilo aggiornato.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Salvataggio non riuscito");
    }
  };

  const onPick = async (file?: File) => {
    if (!file) return;
    try {
      const data = await toAvatarData(file);
      setAvatar(data);
      await persist({ avatarUrl: data });
    } catch {
      setMessage("Non riesco a leggere questa immagine.");
    }
  };

  if (!isAuthenticated) return null;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">Il tuo profilo pubblico</h2>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <div className="relative h-24 w-24 overflow-hidden rounded-full bg-primary/10">
            {avatar ? (
              <img src={avatar} alt="Foto profilo" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center font-display text-2xl font-semibold text-primary">
                {(username || "SK").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" /> Cambia foto
          </Button>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Nome utente
            </label>
            <Input
              id="username"
              value={username}
              maxLength={40}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Come ti trovano gli amici"
            />
          </div>
          <div>
            <label htmlFor="bio" className="text-sm font-medium text-foreground">
              Biografia
            </label>
            <Textarea
              id="bio"
              value={bio}
              maxLength={400}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Due righe su di te: sci preferiti, comprensori del cuore…"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => void persist({ username, bio })}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva
            </Button>
            {message && <span className="text-sm text-muted-foreground">{message}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
