 "use client";

 interface ConnectorStatusItem {
   key: string;
   label: string;
   configured: boolean;
 }

 export default function ConnectorStatusDropdown({
   title = "Connector Status",
   items,
   align = "right",
 }: {
   title?: string;
   items: ConnectorStatusItem[];
   align?: "left" | "right";
 }) {
   if (!items || items.length === 0) return null;

   const configuredCount = items.filter((item) => item.configured).length;
   const panelAlign = align === "left" ? "left-0" : "right-0";

   return (
     <details className="relative">
       <summary className="list-none cursor-pointer select-none text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-2">
         <span className="text-white/80">{title}</span>
         <span className="text-white/50">{configuredCount}/{items.length} configured</span>
         <span className="text-white/40">▾</span>
       </summary>
       <div className={`absolute ${panelAlign} mt-2 w-72 max-w-[80vw] rounded-lg border border-white/10 bg-[#0f1117] shadow-xl z-50`}>
         <div className="max-h-64 overflow-y-auto p-2">
           {items.map((connector) => (
             <div
               key={connector.key}
               className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/5"
             >
               <span className="text-xs text-white/80">{connector.label}</span>
               <span
                 className={`text-[10px] px-2 py-0.5 rounded-full border ${
                   connector.configured
                     ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                     : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                 }`}
               >
                 {connector.configured ? "Configured" : "Not Configured"}
               </span>
             </div>
           ))}
         </div>
       </div>
     </details>
   );
 }
