"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      <div className="flex items-center justify-between">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
      <div className="grid gap-4 md:grid-cols-3">
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
          <div className="flex items-end gap-4">
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
            <div className="w-40 space-y-2">
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
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            const remaining = goal.targetAmount - goal.currentAmount;
            const isComplete = goal.currentAmount >= goal.targetAmount;
            const timeline = getTimelineInfo(goal);

            return (
              <Card key={goal.id} className={isComplete ? "border-green-500/50 bg-green-500/5" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {goal.name}
                        {isComplete && <Badge className="bg-green-500">Complete</Badge>}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={PRIORITY_COLORS[goal.priority]}>
                          {PRIORITY_LABELS[goal.priority]}
                        </Badge>
                        {goal.deadline && (
                          <span>Due {formatDate(goal.deadline)}</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(goal)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{formatMoney(goal.currentAmount)}</span>
                      <span className="text-muted-foreground">{formatMoney(goal.targetAmount)}</span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-3" />
                    <p className="mt-1 text-sm text-muted-foreground">
                      {progress.toFixed(1)}% -- {formatMoney(remaining)} to go
                    </p>
                  </div>

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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
