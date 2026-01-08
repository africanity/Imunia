"use client";

import {
  Building2,
  Users,
  Activity,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  CheckCircle,
  BarChart3,
  Package,
} from "lucide-react";
import type { HealthCenterDetailedStats } from "../types";

interface HealthCenterDetailViewProps {
  stats: HealthCenterDetailedStats;
}

export default function HealthCenterDetailView({ stats }: HealthCenterDetailViewProps) {
  const maxMonthlyValue = Math.max(...stats.monthlyVaccinations.map((m) => m.value), 1);
  const maxVaccinations = Math.max(...stats.agentStats.map((a) => a.vaccinations), 1);

  return (
    <div className="space-y-6">
      {/* En-tête centre de santé */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-teal-600 rounded-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{stats.healthCenter}</h2>
            <p className="text-gray-600">
              {stats.healthCenterType} - {stats.district}, {stats.region}
            </p>
          </div>
        </div>

        {/* KPIs du centre */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.summary.totalChildren.toLocaleString()}</div>
            <div className="text-xs text-gray-600">Enfants</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <Activity className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.summary.totalVaccinations.toLocaleString()}</div>
            <div className="text-xs text-gray-600">Vaccinations</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <TrendingUp className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.summary.coverageRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-600">Couverture</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <UserCheck className="h-6 w-6 text-teal-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.summary.totalAgents}</div>
            <div className="text-xs text-gray-600">Agents</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.summary.activeAgents}</div>
            <div className="text-xs text-gray-600">Actifs</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.summary.overdueVaccinations}</div>
            <div className="text-xs text-gray-600">En retard</div>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution mensuelle */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-teal-600" />
            Évolution mensuelle - {stats.healthCenter}
          </h3>
          <div className="space-y-3">
            {stats.monthlyVaccinations.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-20 text-sm font-medium text-gray-700">{item.month}</div>
                <div className="flex-1">
                  <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-teal-600 flex items-center justify-end pr-3 text-white text-xs font-bold transition-all duration-500"
                      style={{
                        width: item.value > 0 ? `${Math.max((item.value / maxMonthlyValue) * 100, 5)}%` : "0%",
                        minWidth: item.value > 0 ? "40px" : "0",
                      }}
                    >
                      {item.value > 0 && item.value.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution par vaccin */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Répartition par vaccin
          </h3>
          {stats.vaccineDistribution && stats.vaccineDistribution.length > 0 ? (
            <div className="space-y-3">
              {stats.vaccineDistribution.map((vaccine, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{vaccine.name}</span>
                  <span className="text-sm font-bold text-gray-900">{vaccine.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Aucune donnée disponible</p>
            </div>
          )}
        </div>
      </div>

      {/* Agents */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-teal-600" />
          Agents du centre de santé
        </h3>
        {stats.agentStats && stats.agentStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Agent</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Niveau</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Vaccinations</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Enfants vaccinés</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Taux de réussite</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                </tr>
              </thead>
              <tbody>
                {stats.agentStats.map((agent, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{agent.agentName}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-600">{agent.agentEmail}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-600">{agent.agentLevel || "N/A"}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{agent.vaccinations.toLocaleString()}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-gray-700">{agent.childrenVaccinated}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[100px]">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                agent.successRate >= 90
                                  ? "bg-green-500"
                                  : agent.successRate >= 75
                                  ? "bg-blue-500"
                                  : agent.successRate >= 50
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(agent.successRate, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-700">{agent.successRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          agent.active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {agent.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <UserCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Aucun agent dans ce centre de santé</p>
          </div>
        )}
      </div>
    </div>
  );
}






