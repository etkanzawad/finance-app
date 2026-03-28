"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatMoney, formatDate, dollarsToCents, centsToDollars } from "@/lib/format";
import { Plus, Pencil, Trash2, Target, TrendingUp, AlertTriangle, Calculator } from "lucide-react";
import { toast } from "sonner";

interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  priority: number;
  createdAt: string;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Someday",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-amber-500",
  4: "text-blue-500",
  5: "text-muted-foreground",
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [bnplExposure, setBnplExposure] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formCurrent, setFormCurrent] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formPriority, setFormPriority] = useState("3");

  // Contribution calculator
  const [calcGoalId, setCalcGoalId] = useState<number | null>(null);
  const [calcAmount, setCalcAmount] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, bnplRes] = await Promise.all([
        fetch("/api/savings-goals"),
        fetch("/api/bnpl-plans"),
      ]);
      const goalsData = await goalsRes.json();
      setGoals(goalsData);

      if (bnplRes.ok) {
        const bnplData = await bnplRes.json();
        const exposure = bnplData.reduce(
          (sum: number, p: { instalmentAmount: number; instalmentsRemaining: number }) =>
            sum + p.instalmentAmount * p.instalmentsRemaining,
          0
        );
        setBnplExposure(exposure);
      }
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function resetForm() {
    setFormName("");
    setFormTarget("");
    setFormCurrent("");
    setFormDeadline("");
    setFormPriority("3");
    setEditingGoal(null);
  }

  function openEdit(goal: SavingsGoal) {
    setEditingGoal(goal);
    setFormName(goal.name);
    setFormTarget(centsToDollars(goal.targetAmount).toFixed(2));
    setFormCurrent(centsToDollars(goal.currentAmount).toFixed(2));
    setFormDeadline(goal.deadline || "");
    setFormPriority(String(goal.priority));
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: formName,
      targetAmount: dollarsToCents(parseFloat(formTarget)),
      currentAmount: dollarsToCents(parseFloat(formCurrent || "0")),
      deadline: formDeadline || null,
      priority: Number(formPriority),
    };

    try {
      if (editingGoal) {
        await fetch(`/api/savings-goals/${editingGoal.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Goal updated");
      } else {
        await fetch("/api/savings-goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Goal created");
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error("Failed to save goal");
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetch(`/api/savings-goals/${id}`, { method: "DELETE" });
      toast.success("Goal deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete goal");
    }
  }

  async function handleContribution() {
    if (!calcGoalId || !calcAmount) return;
    const goal = goals.find((g) => g.id === calcGoalId);
    if (!goal) return;

    const newAmount = goal.currentAmount + dollarsToCents(parseFloat(calcAmount));
    try {
      await fetch(`/api/savings-goals/${calcGoalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...goal,
          currentAmount: Math.min(newAmount, goal.targetAmount),
        }),
      });
      toast.success(`Added ${formatMoney(dollarsToCents(parseFloat(calcAmount)))} to ${goal.name}`);
      setCalcAmount("");
      setCalcGoalId(null);
      fetchData();
    } catch {
      toast.error("Failed to add contribution");
    }
  }

  // Compute totals
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  function getTimelineInfo(goal: SavingsGoal) {
    if (!goal.deadline) return null;
    const remaining = goal.targetAmount - goal.currentAmount;
    if (remaining <= 0) return { daysLeft: 0, monthlyNeeded: 0, onTrack: true };

    const now = new Date();
    const deadline = new Date(goal.deadline);
    const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const monthsLeft = Math.max(0.5, daysLeft / 30.44);
    const monthlyNeeded = remaining / monthsLeft;

    return { daysLeft, monthlyNeeded: Math.round(monthlyNeeded), onTrack: daysLeft > 0 };
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Savings Goals</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground">
            Track progress towards your financial goals
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Edit Goal" : "New Savings Goal"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Goal Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Emergency Fund"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formCurrent}
                    onChange={(e) => setFormCurrent(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deadline (optional)</Label>
                  <Input
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formPriority} onValueChange={setFormPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Critical</SelectItem>
                      <SelectItem value="2">High</SelectItem>
                      <SelectItem value="3">Medium</SelectItem>
                      <SelectItem value="4">Low</SelectItem>
                      <SelectItem value="5">Someday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">
                {editingGoal ? "Update Goal" : "Create Goal"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Saved</CardDescription>
            <CardTitle className="text-2xl text-green-500">{formatMoney(totalSaved)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              of {formatMoney(totalTarget)} target
            </p>
            <Progress value={overallProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Goals</CardDescription>
            <CardTitle className="text-2xl">{goals.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {goals.filter((g) => g.currentAmount >= g.targetAmount).length} completed
            </p>
          </CardContent>
        </Card>

        {bnplExposure > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                BNPL Impact
              </CardDescription>
              <CardTitle className="text-2xl text-amber-500">{formatMoney(bnplExposure)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                in BNPL commitments reducing your savings capacity
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Contribution Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Quick Contribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>Goal</Label>
              <Select
                value={calcGoalId ? String(calcGoalId) : ""}
                onValueChange={(v) => setCalcGoalId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a goal" />
                </SelectTrigger>
                <SelectContent>
                  {goals
                    .filter((g) => g.currentAmount < g.targetAmount)
                    .map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name} ({formatMoney(g.targetAmount - g.currentAmount)} remaining)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 sm:w-40">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                placeholder="50.00"
              />
            </div>
            <Button onClick={handleContribution} disabled={!calcGoalId || !calcAmount}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Goal Cards */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No savings goals yet</p>
            <p className="text-muted-foreground">Create your first goal to start tracking progress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {goals.map((goal) => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            const isComplete = goal.currentAmount >= goal.targetAmount;

            return (
              <button
                key={goal.id}
                onClick={() => setSelectedGoal(goal)}
                className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3.5 text-left backdrop-blur-sm transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-zinc-200">{goal.name}</p>
                    {isComplete && <Badge className="bg-green-500 text-xs">Done</Badge>}
                  </div>
                  <div className="mt-1 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-zinc-100">{formatMoney(goal.currentAmount)}</p>
                  <p className="text-xs tabular-nums text-zinc-600">of {formatMoney(goal.targetAmount)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Goal Detail Dialog */}
      <Dialog open={!!selectedGoal} onOpenChange={(open) => { if (!open) setSelectedGoal(null); }}>
        <DialogContent>
          {selectedGoal && (() => {
            const progress = (selectedGoal.currentAmount / selectedGoal.targetAmount) * 100;
            const remaining = selectedGoal.targetAmount - selectedGoal.currentAmount;
            const isComplete = selectedGoal.currentAmount >= selectedGoal.targetAmount;
            const timeline = getTimelineInfo(selectedGoal);

            return (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedGoal.name}</DialogTitle>
                  <DialogDescription asChild>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="outline" className={PRIORITY_COLORS[selectedGoal.priority]}>
                        {PRIORITY_LABELS[selectedGoal.priority]}
                      </Badge>
                      {selectedGoal.deadline && (
                        <span className="text-sm text-muted-foreground">Due {formatDate(selectedGoal.deadline)}</span>
                      )}
                      {isComplete && <Badge className="bg-green-500">Complete</Badge>}
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{formatMoney(selectedGoal.currentAmount)}</span>
                      <span className="text-muted-foreground">{formatMoney(selectedGoal.targetAmount)}</span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-3" />
                    <p className="mt-1 text-sm text-muted-foreground">
                      {progress.toFixed(1)}% -- {formatMoney(remaining)} to go
                    </p>
                  </div>

                  {/* Timeline */}
                  {timeline && !isComplete && (
                    <>
                      <Separator />
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {timeline.daysLeft} days left -- need{" "}
                          <span className="font-medium">{formatMoney(timeline.monthlyNeeded)}/mo</span>
                        </span>
                      </div>
                    </>
                  )}

                  {/* BNPL Warning */}
                  {bnplExposure > 0 && !isComplete && (
                    <div className="flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-500">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>
                        Your {formatMoney(bnplExposure)} BNPL exposure could delay this goal by{" "}
                        {timeline
                          ? `~${Math.ceil(bnplExposure / (timeline.monthlyNeeded || 1))} months`
                          : "several months"}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedGoal(null);
                        openEdit(selectedGoal);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={() => {
                        const goalId = selectedGoal.id;
                        setSelectedGoal(null);
                        handleDelete(goalId);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
