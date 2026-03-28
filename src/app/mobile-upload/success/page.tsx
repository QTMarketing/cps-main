export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold">Invoice uploaded successfully</h1>
        <p className="text-muted-foreground">You can now close this window.</p>
      </div>
    </div>
  );
}


