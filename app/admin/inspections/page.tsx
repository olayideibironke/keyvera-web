"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Inspection = {
  id: string;
  property_id: string;
  tenant_user_id: string;
  status: string;
  inspection_fee_ngn: number;
  created_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
};

export default function AdminInspectionsPage() {

  const [rows,setRows] = useState<Inspection[]>([]);
  const [loading,setLoading] = useState(true);
  const [status,setStatus] = useState<string>("all");

  async function load(){

    setLoading(true);

    const {data,error} = await supabase
      .from("inspection_requests")
      .select("*")
      .order("created_at",{ascending:false});

    if(!error){
      setRows(data ?? []);
    }

    setLoading(false);

  }

  useEffect(()=>{
    load();
  },[]);

  function filteredRows(){

    if(status === "all") return rows;

    return rows.filter(r => r.status === status);

  }

  async function cancelInspection(id:string){

    await supabase.rpc("admin_cancel_inspection",{p_inspection_id:id});

    load();

  }

  return(

    <main className="mx-auto max-w-6xl px-6 py-10">

      <h1 className="text-3xl font-semibold mb-6">
        Admin Inspections
      </h1>

      <div className="flex gap-3 mb-8">

        <button
        onClick={()=>setStatus("all")}
        className={`px-3 py-1 rounded border ${status==="all"?"bg-black text-white":""}`}
        >
        All
        </button>

        <button
        onClick={()=>setStatus("requested")}
        className={`px-3 py-1 rounded border ${status==="requested"?"bg-black text-white":""}`}
        >
        Requested
        </button>

        <button
        onClick={()=>setStatus("paid")}
        className={`px-3 py-1 rounded border ${status==="paid"?"bg-black text-white":""}`}
        >
        Paid
        </button>

        <button
        onClick={()=>setStatus("scheduled")}
        className={`px-3 py-1 rounded border ${status==="scheduled"?"bg-black text-white":""}`}
        >
        Scheduled
        </button>

        <button
        onClick={()=>setStatus("completed")}
        className={`px-3 py-1 rounded border ${status==="completed"?"bg-black text-white":""}`}
        >
        Completed
        </button>

        <button
        onClick={()=>setStatus("cancelled")}
        className={`px-3 py-1 rounded border ${status==="cancelled"?"bg-black text-white":""}`}
        >
        Cancelled
        </button>

      </div>

      {loading && <div>Loading...</div>}

      {!loading && filteredRows().length === 0 && (
        <div>No inspections.</div>
      )}

      {!loading && filteredRows().length > 0 && (

        <div className="border rounded-xl overflow-x-auto">

          <table className="min-w-[1100px] w-full text-sm">

            <thead className="bg-gray-50">

              <tr>

                <th className="p-4 text-left">Inspection ID</th>
                <th className="p-4 text-left">Property</th>
                <th className="p-4 text-left">Tenant</th>
                <th className="p-4 text-left">Fee</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Requested</th>
                <th className="p-4 text-left">Scheduled</th>
                <th className="p-4 text-left">Completed</th>
                <th className="p-4 text-left">Actions</th>

              </tr>

            </thead>

            <tbody>

              {filteredRows().map((r)=>(
                <tr key={r.id} className="border-t">

                  <td className="p-4">{r.id.slice(0,8)}</td>

                  <td className="p-4">{r.property_id.slice(0,8)}</td>

                  <td className="p-4">{r.tenant_user_id.slice(0,8)}</td>

                  <td className="p-4">
                    ₦{r.inspection_fee_ngn.toLocaleString()}
                  </td>

                  <td className="p-4 font-semibold">
                    {r.status}
                  </td>

                  <td className="p-4">
                    {new Date(r.created_at).toLocaleString()}
                  </td>

                  <td className="p-4">
                    {r.scheduled_at
                      ? new Date(r.scheduled_at).toLocaleString()
                      : "—"}
                  </td>

                  <td className="p-4">
                    {r.completed_at
                      ? new Date(r.completed_at).toLocaleString()
                      : "—"}
                  </td>

                  <td className="p-4">

                    {r.status !== "completed" && r.status !== "cancelled" && (
                      <button
                      onClick={()=>cancelInspection(r.id)}
                      className="px-3 py-1 border rounded"
                      >
                      Cancel
                      </button>
                    )}

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      )}

    </main>

  );

}