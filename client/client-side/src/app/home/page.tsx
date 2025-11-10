"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ParsedField {
  field: string;
  value: string;
}

type ParsedData = ParsedField[];

function HomeContent() {
  const { user, logout, token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Hanya file PDF yang diizinkan");
      return;
    }
    setSelectedFile(file);
    setError("");
    setParsedData(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) {
      setError("File tidak dipilih atau Anda belum login");
      return;
    }

    setIsUploading(true);
    setError("");
    setParsedData(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.detail || "Upload failed");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Upload failed");
      }

      // Gunakan dataArray dari response server
      if (data.dataArray && Array.isArray(data.dataArray)) {
        setParsedData(data.dataArray);
      } else {
        throw new Error("Format data tidak valid");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengupload file");
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setParsedData(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <nav className="bg-white dark:bg-zinc-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
              PDF Parser
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Welcome,{" "}
                <span className="font-medium text-black dark:text-zinc-50">
                  {user?.username}
                </span>
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-6">
              Upload PDF File
            </h2>

            {/* Drag and Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-blue-400"
              }`}
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <svg
                      className="w-16 h-16 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-black dark:text-zinc-50">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {isUploading ? "Uploading..." : "Upload & Parse"}
                    </button>
                    <button
                      onClick={handleClear}
                      disabled={isUploading}
                      className="px-6 py-2 bg-zinc-200 dark:bg-zinc-700 text-black dark:text-zinc-50 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <svg
                      className="w-16 h-16 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-black dark:text-zinc-50">
                      Drag and drop PDF file here
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      or click to browse
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Select PDF File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Loading Section */}
          {isUploading && !parsedData && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-8">
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-lg font-medium text-black dark:text-zinc-50">
                  Memproses PDF...
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                  Mohon tunggu, sedang memparse data dari file PDF
                </p>
              </div>
            </div>
          )}

          {/* Results Section */}
          {parsedData && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-6">
                Parsed Data Results
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                  <thead className="bg-zinc-50 dark:bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-1/3">
                        Field
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-2/3">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700">
                    {parsedData.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <td className="px-4 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 break-words">
                          {item.field}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400 break-words">
                          {item.value || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}
