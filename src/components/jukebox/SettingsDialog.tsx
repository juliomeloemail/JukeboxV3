import { useState } from "react";
import { FolderSearch, RefreshCw, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJukebox } from "@/lib/jukebox/store";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="w-56 shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog() {
  const { settings, updateSettings, rescan, library, network, demoMode } = useJukebox();
  const [folder, setFolder] = useState(settings.musicFolder);
  const [scanning, setScanning] = useState(false);

  const guestUrl =
    network?.guestUrl ?? `http://${network?.addresses[0] ?? "seu-ip"}:${settings.serverPort}/guest`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <Settings2 className="size-4" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Configurações da Jukebox</DialogTitle>
          <DialogDescription>
            Ajuste pasta de músicas, áudio, rede local e comportamento da festa.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="musica">
          <TabsList className="w-full">
            <TabsTrigger value="musica" className="flex-1">
              Músicas
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex-1">
              Áudio
            </TabsTrigger>
            <TabsTrigger value="rede" className="flex-1">
              Rede
            </TabsTrigger>
            <TabsTrigger value="festa" className="flex-1">
              Festa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="musica" className="pt-2">
            <Row label="Pasta das músicas" hint="Inclui todas as subpastas automaticamente.">
              <Input value={folder} onChange={(e) => setFolder(e.target.value)} />
            </Row>
            <div className="flex gap-2 pb-3">
              <Button
                size="sm"
                onClick={async () => {
                  updateSettings({ musicFolder: folder });
                  setScanning(true);
                  await rescan(folder);
                  setScanning(false);
                }}
                disabled={scanning}
                className="gap-2"
              >
                <RefreshCw className={scanning ? "size-4 animate-spin" : "size-4"} />
                Reler pasta
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2"
                onClick={() => setFolder("C:\\musicas\\jukebox")}
              >
                <FolderSearch className="size-4" />
                Restaurar padrão
              </Button>
            </div>
            <Separator />
            <p className="pt-3 text-xs text-muted-foreground">
              {library.tracks.length} músicas carregadas
              {demoMode ? " (acervo de demonstração)" : ` de ${library.folder}`}.
            </p>
          </TabsContent>

          <TabsContent value="audio" className="pt-2">
            <Row label="Volume geral">
              <Slider
                value={[settings.volume * 100]}
                max={100}
                onValueChange={([v]) => updateSettings({ volume: (v ?? 0) / 100 })}
              />
            </Row>
            <Separator />
            <Row label="Crossfade" hint={`${settings.crossfade}s de transição entre faixas`}>
              <Slider
                value={[settings.crossfade]}
                max={12}
                onValueChange={([v]) => updateSettings({ crossfade: v ?? 0 })}
              />
            </Row>
            <Separator />
            <Row label="Equalizar volume" hint="Evita que uma música entre muito mais alta.">
              <div className="flex justify-end">
                <Switch
                  checked={settings.normalize}
                  onCheckedChange={(v) => updateSettings({ normalize: v })}
                />
              </div>
            </Row>
            <Separator />
            <Row label="Suavizar ao pular" hint="Diminui o som antes de trocar de faixa.">
              <div className="flex justify-end">
                <Switch
                  checked={settings.fadeOnSkip}
                  onCheckedChange={(v) => updateSettings({ fadeOnSkip: v })}
                />
              </div>
            </Row>
            <Separator />
            <Row label="Saída de som" hint="Nome da caixa/placa usada na festa.">
              <Input
                value={settings.outputLabel}
                onChange={(e) => updateSettings({ outputLabel: e.target.value })}
              />
            </Row>
          </TabsContent>

          <TabsContent value="rede" className="pt-2">
            <Row label="Convidados podem pedir músicas" hint="Pelo celular, no Wi-Fi da casa.">
              <div className="flex justify-end">
                <Switch
                  checked={settings.allowGuests}
                  onCheckedChange={(v) => updateSettings({ allowGuests: v })}
                />
              </div>
            </Row>
            <Separator />
            <Row label="Porta do servidor" hint="Só mude se der conflito.">
              <Input
                type="number"
                value={settings.serverPort}
                onChange={(e) => updateSettings({ serverPort: Number(e.target.value) })}
              />
            </Row>
            <Separator />
            <Row label="Limite por convidado" hint={`${settings.guestLimit} músicas na fila`}>
              <Slider
                value={[settings.guestLimit]}
                min={1}
                max={10}
                onValueChange={([v]) => updateSettings({ guestLimit: v ?? 1 })}
              />
            </Row>
            <Separator />
            <Row label="Convidado pode pular" hint="Permite pular a música atual pelo celular.">
              <div className="flex justify-end">
                <Switch
                  checked={settings.guestCanSkip}
                  onCheckedChange={(v) => updateSettings({ guestCanSkip: v })}
                />
              </div>
            </Row>
            <div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs">
              <p className="font-semibold">Endereço para os convidados</p>
              <p className="mt-1 break-all text-primary">{guestUrl}</p>
              {network?.addresses?.length ? (
                <p className="mt-1 text-muted-foreground">
                  Rede detectada: {network.addresses.join(", ")}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  O endereço aparece quando o programa roda no computador da festa.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="festa" className="pt-2">
            <Row label="Nome da festa" hint="Aparece na tela dos convidados.">
              <Input
                value={settings.partyName}
                onChange={(e) => updateSettings({ partyName: e.target.value })}
              />
            </Row>
            <Separator />
            <Row label="Tocar sozinho" hint="Sorteia músicas quando a fila acaba.">
              <div className="flex justify-end">
                <Switch
                  checked={settings.autoShuffle}
                  onCheckedChange={(v) => updateSettings({ autoShuffle: v })}
                />
              </div>
            </Row>
            <Separator />
            <Row label="Manter tela ligada" hint="Impede o computador de dormir durante a festa.">
              <div className="flex justify-end">
                <Switch
                  checked={settings.screenAlwaysOn}
                  onCheckedChange={(v) => updateSettings({ screenAlwaysOn: v })}
                />
              </div>
            </Row>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
