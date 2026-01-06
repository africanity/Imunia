"use client";

import { BarChart3, MapPin, Syringe, Target } from "lucide-react";
import type { TabType } from "../types";

interface TabNavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function TabNavigation({ activeTab, setActiveTab }: TabNavigationProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-2">
      <div className="flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg transform scale-105"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <BarChart3 className="h-5 w-5" />
          Vue d'ensemble
        </button>
        <button
          onClick={() => setActiveTab("regions")}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition whitespace-nowrap ${
            activeTab === "regions"
              ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <MapPin className="h-5 w-5" />
          Analyse Régionale
        </button>
        <button
          onClick={() => setActiveTab("vaccines")}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition whitespace-nowrap ${
            activeTab === "vaccines"
              ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg transform scale-105"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Syringe className="h-5 w-5" />
          Par Vaccin
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition whitespace-nowrap ${
            activeTab === "performance"
              ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg transform scale-105"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Target className="h-5 w-5" />
          Indicateurs
        </button>
      </div>
    </div>
  );
}






