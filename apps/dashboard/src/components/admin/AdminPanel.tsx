import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { UsersTable } from './UsersTable';
import { CallHistoryTable } from './CallHistoryTable';
import { BitacoraView } from './BitacoraView';
import { ReportsPanel } from './ReportsPanel';

export function AdminPanel() {
  return (
    <div className="p-6">
      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="calls">Historial</TabsTrigger>
          <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTable /></TabsContent>
        <TabsContent value="calls"><CallHistoryTable /></TabsContent>
        <TabsContent value="bitacora"><BitacoraView /></TabsContent>
        <TabsContent value="reports"><ReportsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
