import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ClipboardList, LogOut, Clock, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ProgressData {
  week: string;
  pain: number;
  stiffness: number;
  rightKneeROM: number;
  leftKneeROM: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userName, setUserName] = useState("User");
  const [canCheckin, setCanCheckin] = useState(true);
  const [daysUntilCheckin, setDaysUntilCheckin] = useState(0);
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeDashboard = async () => {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Get user email as name
      setUserName(session.user.email?.split("@")[0] || "User");

      try {
        // Check if user can check in
        const { data: canCheckinData, error: checkinError } = await supabase
          .rpc('can_checkin', { _user_id: session.user.id });

        if (!checkinError) {
          setCanCheckin(canCheckinData);
        }

        // Get days until next check-in
        const { data: daysData, error: daysError } = await supabase
          .rpc('days_until_checkin', { _user_id: session.user.id });

        if (!daysError && daysData !== null) {
          setDaysUntilCheckin(daysData);
        }

        // Fetch weekly check-ins for progress charts
        const { data: checkins, error: checkinsError } = await supabase
          .from('weekly_checkins')
          .select('*')
          .eq('user_id', session.user.id)
          .order('checkin_date', { ascending: true })
          .limit(8);

        if (checkinsError) throw checkinsError;

        // Fetch gait tests for ROM data
        const gaitTestIds = checkins?.map(c => c.gait_test_id).filter(Boolean) || [];
        const { data: gaitTests } = await supabase
          .from('gait_tests')
          .select('*')
          .in('id', gaitTestIds);

        // Transform data for charts
        if (checkins && checkins.length > 0) {
          const chartData: ProgressData[] = checkins.map((checkin, index) => {
            const gaitTest = gaitTests?.find(g => g.id === checkin.gait_test_id);
            return {
              week: `Week ${index + 1}`,
              pain: checkin.pain_score || 0,
              stiffness: checkin.stiffness_score || 0,
              rightKneeROM: gaitTest?.right_knee_rom || 0,
              leftKneeROM: gaitTest?.left_knee_rom || 0,
            };
          });
          setProgressData(chartData);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b-4 border-primary p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-4xl font-bold">Welcome, {userName}!</h1>
          <Button variant="outline" size="icon" onClick={handleLogout} title="Log out">
            <LogOut className="h-8 w-8" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Primary CTA */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-2xl">
          <CardContent className="p-12 text-center">
            {canCheckin ? (
              <>
                <h2 className="text-4xl font-bold mb-6">Ready for This Week's Check-in?</h2>
                <Button
                  variant="secondary"
                  size="lg"
                  className="text-2xl h-24 px-16"
                  onClick={() => navigate("/checkin")}
                >
                  Start This Week's Check-in
                </Button>
              </>
            ) : (
              <>
                <Clock className="h-16 w-16 mx-auto mb-4" />
                <h2 className="text-4xl font-bold mb-4">Next Check-in Available In</h2>
                <div className="text-6xl font-bold mb-6">{daysUntilCheckin} days</div>
                <p className="text-xl opacity-90">You can only check in once per week</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Progress Charts */}
        {loading ? (
          <Card className="p-12">
            <div className="text-center text-xl text-muted-foreground">Loading progress data...</div>
          </Card>
        ) : progressData.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground" />
              <div className="text-2xl font-semibold">No Progress Data Yet</div>
              <p className="text-lg text-muted-foreground">Complete your first weekly check-in to start tracking your progress!</p>
            </div>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Subjective Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">My Progress (Subjective)</CardTitle>
                <CardDescription className="text-lg">Pain and stiffness scores over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" style={{ fontSize: '16px' }} />
                    <YAxis domain={[0, 10]} style={{ fontSize: '16px' }} />
                    <Tooltip contentStyle={{ fontSize: '16px' }} />
                    <Legend wrapperStyle={{ fontSize: '16px' }} />
                    <Line
                      type="monotone"
                      dataKey="pain"
                      stroke="hsl(var(--chart-pain))"
                      strokeWidth={3}
                      name="Pain Score"
                    />
                    <Line
                      type="monotone"
                      dataKey="stiffness"
                      stroke="hsl(var(--chart-stiffness))"
                      strokeWidth={3}
                      name="Stiffness Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gait Test Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">My Progress (Gait Test)</CardTitle>
                <CardDescription className="text-lg">Knee range of motion</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" style={{ fontSize: '16px' }} />
                    <YAxis domain={[0, 180]} style={{ fontSize: '16px' }} />
                    <Tooltip contentStyle={{ fontSize: '16px' }} />
                    <Legend wrapperStyle={{ fontSize: '16px' }} />
                    <Line
                      type="monotone"
                      dataKey="rightKneeROM"
                      stroke="hsl(var(--chart-gait))"
                      strokeWidth={3}
                      name="Right Knee ROM (°)"
                    />
                    <Line
                      type="monotone"
                      dataKey="leftKneeROM"
                      stroke="hsl(var(--chart-primary))"
                      strokeWidth={3}
                      name="Left Knee ROM (°)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 pb-8">
          <Button
            variant="default"
            size="lg"
            className="flex-1"
          >
            <Home className="h-8 w-8 mr-2" />
            Dashboard
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => navigate("/exercises")}
          >
            <ClipboardList className="h-8 w-8 mr-2" />
            My Exercises
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
