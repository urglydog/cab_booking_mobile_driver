import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, ArrowUpRight, ChevronRight, X, HelpCircle, MapPin, Bike, Car, ChevronDown, ChevronUp, Star } from 'lucide-react-native';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

interface CompletedJob {
  id: string;
  pickupLocation: string;
  dropoffLocation: string;
  estimatedFare: number;
  createdAt: string;
  customerName: string;
  status?: string;
  paymentMethod?: string;
  distance?: string;
}

export default function DriverEarningsScreen() {
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [netBalance, setNetBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<CompletedJob | null>(null);
  const [selectedJobReview, setSelectedJobReview] = useState<any>(null);
  const [driverName, setDriverName] = useState('Tài xế');
  
  // Custom expandable accordions for the detail panel
  const [expandedSections, setExpandedSections] = useState({
    income: true,
    payment: false,
    fees: false,
    feedback: true,
  });

  const [selectedDateIndex, setSelectedDateIndex] = useState(5);
  const [periodMode, setPeriodMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(3);

  const buildRecentCalendar = () => {
    const labels = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
    const today = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (5 - index));
      return {
        dayName: labels[date.getDay()],
        date: String(date.getDate()).padStart(2, '0'),
        month: date.getMonth(),
        year: date.getFullYear(),
        isToday: index === 5,
      };
    });
  };

  const calendar = buildRecentCalendar();

  const buildRecentWeeks = () => {
    const today = new Date();
    const startOfCurrentWeek = new Date(today);
    const mondayOffset = (today.getDay() + 6) % 7;
    startOfCurrentWeek.setDate(today.getDate() - mondayOffset);
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    return Array.from({ length: 4 }, (_, index) => {
      const start = new Date(startOfCurrentWeek);
      start.setDate(startOfCurrentWeek.getDate() - (3 - index) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return {
        label: `Tuần ${getWeekNumber(start)}`,
        range: `${start.getDate()} - ${end.getDate()}`,
        start,
        end,
      };
    });
  };

  const getWeekNumber = (date: Date) => {
    const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    return Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const weeks = buildRecentWeeks();

  const getValidDistance = (distance?: string) => {
    if (!distance) return null;
    const match = String(distance).replace(',', '.').match(/([\d.]+)\s*km/i);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) return null;
    return `${value.toFixed(value < 10 ? 1 : 2)} km`;
  };

  const dedupeJobs = (items: CompletedJob[]) => {
    const seen = new Set<string>();
    return items.filter((job) => {
      const id = String(job?.id ?? '').trim();
      if (!id || id.startsWith('booking-seed-') || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const fetchEarningsAndJobs = async () => {
    try {
      setLoading(true);

      // Fetch driver name from AsyncStorage
      const storedName = await AsyncStorage.getItem('user_name');
      if (storedName) {
        setDriverName(storedName);
      }
      
      // 1. Fetch completed simulated jobs from AsyncStorage
      const storedJobsJson = await AsyncStorage.getItem('driver_completed_jobs');
      let localJobs: CompletedJob[] = storedJobsJson ? JSON.parse(storedJobsJson) : [];

      // Filter invalid, seeded, and duplicated local rides.
      localJobs = dedupeJobs(localJobs);

      // 2. Fetch database rides from API as fallback/merge
      try {
        const userId = await AsyncStorage.getItem('user_id');
        if (userId) {
          const response = await api.get(`/api/v1/bookings/driver/${userId}?page=0&size=20`);
          if (response.data && response.data.result && response.data.result.content) {
            const dbRides = response.data.result.content
              .filter((b: any) => b.status === 'COMPLETED' || b.status === 'CANCELLED')
              .map((b: any) => ({
                id: b.id,
                customerName: b.customerId === userId ? 'Khách đặt qua App' : 'Khách hàng',
                pickupLocation: b.pickupLocation,
                dropoffLocation: b.dropoffLocation,
                estimatedFare: b.estimatedFare,
                createdAt: b.createdAt,
                status: b.status,
                paymentMethod: b.paymentMethod || 'CARD'
              }));

            // Merge avoiding duplicates
            dbRides.forEach((dbRide: any) => {
              if (!localJobs.some(r => r.id === dbRide.id)) {
                localJobs.push(dbRide);
              }
            });
          }
        }
      } catch (dbErr) {
        console.log('Driver DB rides not fetched:', dbErr);
      }

      // Sort by newest first
      localJobs = dedupeJobs(localJobs);

      // 3. Fetch withdrawals from AsyncStorage
      const storedWithdrawalsJson = await AsyncStorage.getItem('driver_withdrawals');
      const localWithdrawals = storedWithdrawalsJson ? JSON.parse(storedWithdrawalsJson) : [];

      // Merge rides and withdrawals into combined jobs for display
      const combined = [...localJobs, ...localWithdrawals];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setJobs(combined);

      // Compute Net balance (driver takes 70% net from completed rides, minus total withdrawals)
      const computedEarnings = localJobs.reduce((sum, job) => {
        if (job.status === 'CANCELLED') return sum;
        return sum + (job.estimatedFare || 0) * 0.70;
      }, 0);

      const totalWithdrawn = localWithdrawals.reduce((sum: number, w: any) => sum + Math.abs(w.estimatedFare), 0);

      setNetBalance(Math.max(0, Math.round(computedEarnings) - totalWithdrawn));
    } catch (err) {
      console.log('Error loading earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarningsAndJobs();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchEarningsAndJobs();
    }, [])
  );

  useEffect(() => {
    const fetchSelectedJobReview = async () => {
      if (!selectedJob || selectedJob.status === 'CANCELLED' || selectedJob.status === 'WITHDRAWAL') {
        setSelectedJobReview(null);
        return;
      }
      try {
        const response = await api.get(`/api/reviews/ride/${selectedJob.id}`);
        if (response.data) {
          setSelectedJobReview(response.data);
        } else {
          setSelectedJobReview(null);
        }
      } catch (err) {
        setSelectedJobReview(null);
      }
    };
    fetchSelectedJobReview();
  }, [selectedJob]);

  const handleWithdraw = () => {
    if (netBalance === 0) {
      Alert.alert('Không thể rút tiền', 'Số dư ví thu nhập của bạn hiện đang bằng 0đ.');
      return;
    }
    if (netBalance < 50000) {
      Alert.alert('Chưa thể rút tiền', 'Số tiền rút tối thiểu là 50.000đ.');
      return;
    }

    Alert.alert(
      'Xác nhận rút tiền',
      `Bạn có muốn rút toàn bộ số dư đ${netBalance.toLocaleString()} về tài khoản ngân hàng liên kết?\n\nNgân hàng: MB Bank\nSố tài khoản: 9704********6868\nTên tài khoản: ${driverName.toUpperCase()}`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'XÁC NHẬN RÚT',
          onPress: async () => {
            try {
              const amountToWithdraw = netBalance;
              const newWithdrawal = {
                id: `withdraw-${Date.now()}`,
                customerName: 'Rút tiền',
                pickupLocation: 'Rút tiền về MB Bank 9704********6868',
                dropoffLocation: 'Chuyển khoản thành công',
                estimatedFare: -amountToWithdraw,
                createdAt: new Date().toISOString(),
                status: 'WITHDRAWAL',
                paymentMethod: 'BANK'
              };

              const storedWithdrawalsJson = await AsyncStorage.getItem('driver_withdrawals');
              const currentWithdrawals = storedWithdrawalsJson ? JSON.parse(storedWithdrawalsJson) : [];
              currentWithdrawals.push(newWithdrawal);
              await AsyncStorage.setItem('driver_withdrawals', JSON.stringify(currentWithdrawals));

              Alert.alert(
                'Thành công 🎉',
                `Yêu cầu rút tiền đ${amountToWithdraw.toLocaleString()} đã được thực hiện thành công!\n\nTiền đã được chuyển khoản tới tài khoản MB Bank của bạn.`
              );

              // Refresh balance and history list
              fetchEarningsAndJobs();
            } catch (err) {
              console.error('Withdrawal failed:', err);
              Alert.alert('Lỗi', 'Không thể thực hiện yêu cầu rút tiền.');
            }
          }
        }
      ]
    );
  };

  const toggleSection = (section: 'income' | 'payment' | 'fees' | 'feedback') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getFilteredJobs = () => {
    if (periodMode === 'weekly') {
      const selectedWeek = weeks[selectedWeekIndex];
      return jobs.filter(job => {
        try {
          const date = new Date(job.createdAt);
          return date >= selectedWeek.start && date <= selectedWeek.end;
        } catch {
          return false;
        }
      });
    }

    const selectedDay = calendar[selectedDateIndex];
    return jobs.filter(job => {
      try {
        const date = new Date(job.createdAt);
        const dayStr = String(date.getDate()).padStart(2, '0');
        return dayStr === selectedDay.date
          && date.getMonth() === selectedDay.month
          && date.getFullYear() === selectedDay.year;
      } catch {
        return false;
      }
    });
  };

  const formatCompactValue = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1000) {
      return (value / 1000).toFixed(0) + 'k';
    }
    return value.toString();
  };

  const filteredJobs = getFilteredJobs();
  const periodNetEarnings = filteredJobs.reduce((sum, job) => {
    if (job.status === 'CANCELLED' || job.status === 'WITHDRAWAL') return sum;
    return sum + (job.estimatedFare || 0) * 0.70;
  }, 0);
  const selectedWeek = weeks[selectedWeekIndex];
  const periodLabel = periodMode === 'weekly'
    ? `Thu nhập tuần ${getWeekNumber(selectedWeek.start)} (${selectedWeek.start.getDate()}/${selectedWeek.start.getMonth() + 1} - ${selectedWeek.end.getDate()}/${selectedWeek.end.getMonth() + 1})`
    : `Thu nhập ngày ${calendar[selectedDateIndex].date}/${calendar[selectedDateIndex].month + 1}`;
  const weeklyBars = Array.from({ length: 7 }, (_, index) => {
    const labels = ['Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'CN'];
    const day = new Date(selectedWeek.start);
    day.setDate(selectedWeek.start.getDate() + index);
    const dayTotal = jobs.reduce((sum, job) => {
      if (job.status === 'CANCELLED' || job.status === 'WITHDRAWAL') return sum;
      const date = new Date(job.createdAt);
      if (
        date.getDate() === day.getDate()
        && date.getMonth() === day.getMonth()
        && date.getFullYear() === day.getFullYear()
      ) {
        return sum + (job.estimatedFare || 0) * 0.70;
      }
      return sum;
    }, 0);
    return { label: labels[index], value: Math.round(dayTotal) };
  });
  const maxWeeklyBarValue = Math.max(...weeklyBars.map(item => item.value), 1);
  const selectedDistance = selectedJob ? getValidDistance(selectedJob.distance) : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Đang tải báo cáo thu nhập...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thu nhập</Text>
        <HelpCircle size={20} color="#374151" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Horizontal Calendar Navigation (Ảnh 3) */}
        <View style={styles.calendarContainer}>
          <View style={styles.monthRow}>
            <Text style={styles.monthText}>
              tháng {periodMode === 'weekly' ? selectedWeek.start.getMonth() + 1 : calendar[selectedDateIndex].month + 1}
            </Text>
            <View style={styles.periodTabs}>
              <TouchableOpacity
                style={[styles.periodTab, periodMode === 'daily' && styles.periodTabActive]}
                onPress={() => setPeriodMode('daily')}
              >
                <Text style={[styles.periodTabText, periodMode === 'daily' && styles.periodTabTextActive]}>
                  HẰNG NGÀY
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodTab, periodMode === 'weekly' && styles.periodTabActive]}
                onPress={() => setPeriodMode('weekly')}
              >
                <Text style={[styles.periodTabText, periodMode === 'weekly' && styles.periodTabTextActive]}>
                  HẰNG TUẦN
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {periodMode === 'daily' ? (
            <View style={styles.daysRow}>
              {calendar.map((item, index) => {
                const isSelected = selectedDateIndex === index;
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.dayCol, isSelected && styles.dayColSelected]}
                    onPress={() => setSelectedDateIndex(index)}
                  >
                    <Text style={[styles.dayNameText, isSelected && styles.dayNameTextSelected]}>
                      {item.dayName}
                    </Text>
                    <View style={[styles.dateCircle, isSelected && styles.dateCircleSelected]}>
                      <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                        {item.date}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weeksRow}>
              {weeks.map((item, index) => {
                const isSelected = selectedWeekIndex === index;
                return (
                  <TouchableOpacity
                    key={`${item.start.toISOString()}-${index}`}
                    style={[styles.weekCol, isSelected && styles.weekColSelected]}
                    onPress={() => setSelectedWeekIndex(index)}
                  >
                    <Text style={[styles.weekNameText, isSelected && styles.weekNameTextSelected]}>
                      {item.label}
                    </Text>
                    <View style={[styles.weekRangePill, isSelected && styles.weekRangePillSelected]}>
                      <Text style={[styles.weekRangeText, isSelected && styles.weekRangeTextSelected]}>
                        {item.range}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Large Net Earnings Display (Ảnh 1 / 2) */}
        <View style={styles.earningsDashboard}>
          <Text style={styles.dashboardLabel}>{periodLabel}</Text>
          <Text style={styles.dashboardValue}>đ{Math.round(periodNetEarnings).toLocaleString()}</Text>

          {periodMode === 'weekly' && (
            <View style={styles.weeklyChart}>
              {weeklyBars.map((item) => {
                const barHeight = item.value === 0 ? 0 : Math.max(4, Math.round((item.value / maxWeeklyBarValue) * 86));
                return (
                  <View key={item.label} style={styles.weeklyBarCol}>
                    <View style={styles.tooltipContainer}>
                      <View style={styles.tooltipBubble}>
                        <Text style={styles.tooltipText}>{formatCompactValue(item.value)}</Text>
                      </View>
                      <View style={styles.tooltipArrow} />
                    </View>
                    <View style={styles.weeklyBarTrack}>
                      <View style={[styles.weeklyBar, { height: barHeight }]} />
                    </View>
                    <Text style={styles.weeklyBarLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          
          <View style={styles.walletBalanceRow}>
            <Wallet size={16} color="#64748B" />
            <Text style={styles.walletBalanceLabel}>Số dư ví có thể rút: </Text>
            <Text style={styles.walletBalanceValue}>đ{netBalance.toLocaleString()}</Text>
          </View>

          <TouchableOpacity style={styles.withdrawCardButton} onPress={handleWithdraw}>
            <Text style={styles.withdrawCardButtonText}>RÚT TIỀN TRONG VÍ VỀ NGÂN HÀNG</Text>
            <ArrowUpRight size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Header summary of completed rides count */}
        <View style={styles.ridesSummaryHeader}>
          <Text style={styles.ridesSummaryText}>
            {filteredJobs.filter(j => j.status !== 'CANCELLED' && j.status !== 'WITHDRAWAL').length} cuốc xe đã hoàn thành
          </Text>
        </View>

        {/* Completed Ride List (Ảnh 3) */}
        <View style={styles.jobsListContainer}>
          {filteredJobs.length === 0 && (
            <Text style={styles.emptyJobsText}>
              Không có cuốc xe hoàn thành trong khoảng thời gian này.
            </Text>
          )}
          {filteredJobs.map((item) => {
            const isCancelled = item.status === 'CANCELLED';
            const isWithdrawal = item.status === 'WITHDRAWAL';
            const rideNet = isCancelled ? 0 : (isWithdrawal ? item.estimatedFare : Math.round(item.estimatedFare * 0.70));
            
            // Format time e.g. "10:58 CH"
            let timeString = '10:00 CH';
            try {
              const date = new Date(item.createdAt);
              let hours = date.getHours();
              const minutes = String(date.getMinutes()).padStart(2, '0');
              const ampm = hours >= 12 ? 'CH' : 'SA';
              hours = hours % 12;
              hours = hours ? hours : 12; // the hour '0' should be '12'
              timeString = `${hours}:${minutes} ${ampm}`;
            } catch {}

            return (
              <TouchableOpacity 
                key={item.id}
                style={styles.jobItemRow}
                activeOpacity={0.7}
                onPress={() => {
                  if (isWithdrawal) {
                    Alert.alert(
                      'Chi tiết giao dịch',
                      `${item.pickupLocation}\n\nThời gian: ${new Date(item.createdAt).toLocaleString('vi-VN')}\nSố tiền: -${Math.abs(rideNet).toLocaleString()}đ\nTrạng thái: ${item.dropoffLocation}`
                    );
                  } else {
                    setSelectedJob(item);
                  }
                }}
              >
                <View style={styles.jobItemLeft}>
                  <Text style={styles.jobTimeText}>{timeString}</Text>
                  <Text style={styles.jobPickupText} numberOfLines={1}>
                    {item.pickupLocation}
                  </Text>
                  
                  {/* Badges */}
                  {!isWithdrawal ? (
                    <View style={styles.badgeRow}>
                      <View style={styles.paymentMethodBadge}>
                        <Text style={styles.paymentMethodBadgeText}>
                          {item.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Thẻ / Ví'}
                        </Text>
                      </View>
                      {item.estimatedFare > 80000 && !isCancelled && (
                        <View style={styles.promoBadge}>
                          <Text style={styles.promoBadgeText}>Khuyến mãi</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.badgeRow}>
                      <View style={[styles.paymentMethodBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.paymentMethodBadgeText, { color: '#EF4444' }]}>
                          Rút tiền
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.jobItemRight}>
                  {isCancelled ? (
                    <Text style={styles.cancelledTextLabel}>Đã Hủy</Text>
                  ) : isWithdrawal ? (
                    <Text style={[styles.jobEarningsAmount, { color: '#EF4444' }]}>
                      -{Math.abs(rideNet).toLocaleString()}đ
                    </Text>
                  ) : (
                    <Text style={[styles.jobEarningsAmount, { color: '#10B981' }]}>
                      +{rideNet.toLocaleString()}đ
                    </Text>
                  )}
                  <ChevronRight size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      {/* RIDE DETAIL POPUP (Ảnh 2 / 1) */}
      {selectedJob && (
        <Modal
          visible={!!selectedJob}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedJob(null)}
        >
          <SafeAreaView style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedJob(null)}>
                <X size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>
                {new Date(selectedJob.createdAt).toLocaleDateString('vi-VN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}, {
                  (() => {
                    const date = new Date(selectedJob.createdAt);
                    let hours = date.getHours();
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const ampm = hours >= 12 ? 'CH' : 'SA';
                    hours = hours % 12;
                    hours = hours ? hours : 12;
                    return `${hours}:${minutes} ${ampm}`;
                  })()
                }
              </Text>
              <HelpCircle size={22} color="#374151" />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              
              {/* Distance metadata */}
              {selectedDistance && (
                <Text style={styles.modalDistanceText}>
                  {selectedDistance}
                </Text>
              )}

              {/* High-Fidelity Address Cards */}
              <View style={styles.modalRouteCard}>
                <View style={styles.modalRouteIconCol}>
                  <View style={styles.pickupDotGreen} />
                  <View style={styles.routeLineConnector} />
                  <MapPin size={18} color="#EF4444" />
                </View>
                <View style={styles.modalRouteAddressCol}>
                  <Text style={styles.addressLabelHeader}>Điểm đón khách</Text>
                  <Text style={styles.addressLabelText} numberOfLines={2}>{selectedJob.pickupLocation}</Text>
                  
                  <View style={{ height: 20 }} />
                  
                  <Text style={styles.addressLabelHeader}>Điểm trả khách</Text>
                  <Text style={styles.addressLabelText} numberOfLines={2}>{selectedJob.dropoffLocation}</Text>
                </View>
              </View>

              {/* Metadata Info Badges */}
              <View style={styles.detailTagsRow}>
                <View style={styles.modalTag}>
                  <Text style={styles.modalTagText}>
                    {selectedJob.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Thẻ / Ví'}
                  </Text>
                </View>
                <View style={styles.modalTag}>
                  {selectedJob.pickupLocation.includes('Coffee') || selectedJob.estimatedFare > 50000 ? (
                    <Bike size={16} color="#4B5563" />
                  ) : (
                    <Car size={16} color="#4B5563" />
                  )}
                  <Text style={[styles.modalTagText, { marginLeft: 4 }]}>
                    {selectedJob.pickupLocation.includes('Coffee') || selectedJob.estimatedFare > 50000 ? 'Bike' : 'Car4'}
                  </Text>
                </View>
              </View>

              {/* Massive Green Income Display */}
              <View style={styles.modalEarningsSection}>
                <Text style={styles.modalEarningsTitle}>Thu nhập của bạn</Text>
                <Text style={styles.modalEarningsVal}>
                  đ{selectedJob.status === 'CANCELLED' ? '0' : Math.round(selectedJob.estimatedFare * 0.70).toLocaleString()}
                </Text>
              </View>

              {/* COLLAPSIBLE DETAILED ACCORDIONS */}
              
              {/* 1. Thu nhập từ chuyến xe (Ảnh 1) */}
              <View style={styles.accordionContainer}>
                <TouchableOpacity 
                  style={styles.accordionHeader} 
                  onPress={() => toggleSection('income')}
                >
                  <Text style={styles.accordionTitle}>Thu nhập từ chuyến xe</Text>
                  {expandedSections.income ? <ChevronUp size={20} color="#1F2937" /> : <ChevronDown size={20} color="#1F2937" />}
                </TouchableOpacity>

                {expandedSections.income && (
                  <View style={styles.accordionBody}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeftLabel}>Cước phí đón khách</Text>
                      <Text style={styles.detailRightVal}>
                        {selectedJob.status === 'CANCELLED' ? '0đ' : `${Math.round(selectedJob.estimatedFare * 0.70 * 0.05).toLocaleString()}đ`}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeftLabel}>Cước phí chuyến đi</Text>
                      <Text style={styles.detailRightVal}>
                        {selectedJob.status === 'CANCELLED' ? '0đ' : `${Math.round(selectedJob.estimatedFare * 0.70 * 0.95).toLocaleString()}đ`}
                      </Text>
                    </View>
                    <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4 }]}>
                      <Text style={styles.totalIncomeLabel}>Tổng thu nhập từ chuyến xe</Text>
                      <Text style={styles.totalIncomeVal}>
                        đ {selectedJob.status === 'CANCELLED' ? '0' : Math.round(selectedJob.estimatedFare * 0.70).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 2. Thanh toán của hành khách */}
              <View style={styles.accordionContainer}>
                <TouchableOpacity 
                  style={styles.accordionHeader} 
                  onPress={() => toggleSection('payment')}
                >
                  <Text style={styles.accordionTitle}>Thanh toán của hành khách</Text>
                  {expandedSections.payment ? <ChevronUp size={20} color="#1F2937" /> : <ChevronDown size={20} color="#1F2937" />}
                </TouchableOpacity>

                {expandedSections.payment && (
                  <View style={styles.accordionBody}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeftLabel}>Tổng cước phí đặt chuyến</Text>
                      <Text style={styles.detailRightVal}>{selectedJob.estimatedFare.toLocaleString()}đ</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeftLabel}>Hình thức chi trả</Text>
                      <Text style={styles.detailRightVal}>
                        {selectedJob.paymentMethod === 'CASH' ? 'Khách trả Tiền mặt' : 'Khấu trừ Ví điện tử'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 3. Phí sử dụng ứng dụng và Thuế */}
              <View style={styles.accordionContainer}>
                <TouchableOpacity 
                  style={styles.accordionHeader} 
                  onPress={() => toggleSection('fees')}
                >
                  <Text style={styles.accordionTitle}>Phí sử dụng ứng dụng và Thuế</Text>
                  {expandedSections.fees ? <ChevronUp size={20} color="#1F2937" /> : <ChevronDown size={20} color="#1F2937" />}
                </TouchableOpacity>

                {expandedSections.fees && (
                  <View style={styles.accordionBody}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeftLabel}>Phí nền tảng CAB (30% Commission)</Text>
                      <Text style={[styles.detailRightVal, { color: selectedJob.status === 'CANCELLED' ? '#6B7280' : '#EF4444' }]}>
                        {selectedJob.status === 'CANCELLED' ? '0đ' : `-${Math.round(selectedJob.estimatedFare * 0.30).toLocaleString()}đ`}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeftLabel}>Thuế thu nhập cá nhân (đã khấu trừ)</Text>
                      <Text style={styles.detailRightVal}>0đ (Đã bao gồm)</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 4. Trải nghiệm chuyến đi */}
              <View style={styles.accordionContainer}>
                <TouchableOpacity 
                  style={styles.accordionHeader} 
                  onPress={() => toggleSection('feedback')}
                >
                  <Text style={styles.accordionTitle}>Trải nghiệm của bạn như thế nào?</Text>
                  {expandedSections.feedback ? <ChevronUp size={20} color="#1F2937" /> : <ChevronDown size={20} color="#1F2937" />}
                </TouchableOpacity>

                {expandedSections.feedback && (
                  <View style={[styles.accordionBody, { alignItems: 'center', paddingVertical: 14 }]}>
                    <Text style={styles.feedbackPassengerName}>Khách hàng</Text>
                    {selectedJob.status === 'CANCELLED' ? (
                      <Text style={[styles.starsSubtext, { fontStyle: 'italic', marginTop: 4 }]}>
                        Chuyến đi đã bị hủy
                      </Text>
                    ) : selectedJobReview ? (
                      <>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star 
                              key={s} 
                              size={24} 
                              color={s <= selectedJobReview.rating ? '#F59E0B' : '#E5E7EB'} 
                              fill={s <= selectedJobReview.rating ? '#F59E0B' : 'transparent'} 
                              style={{ marginHorizontal: 2 }} 
                            />
                          ))}
                        </View>
                        <Text style={styles.starsSubtext}>
                          {selectedJobReview.comment || 'Khách hàng không để lại nhận xét'}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.starsSubtext, { fontStyle: 'italic', marginTop: 4 }]}>
                        Chuyến đi chưa được khách hàng đánh giá
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Action buttons inside popup */}
              <TouchableOpacity style={styles.closePopupBtn} onPress={() => setSelectedJob(null)}>
                <Text style={styles.closePopupBtnText}>QUAY LẠI TRANG THU NHẬP</Text>
              </TouchableOpacity>

            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  calendarContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'capitalize',
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 3,
  },
  periodTabActive: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 1,
  },
  periodTabTextActive: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  periodTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  periodTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayCol: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  dayColSelected: {
    backgroundColor: '#FFF',
  },
  dayNameText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 6,
  },
  dayNameTextSelected: {
    color: '#10B981',
    fontWeight: '800',
  },
  dateCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateCircleSelected: {
    backgroundColor: '#10B981',
  },
  dateText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  dateTextSelected: {
    color: '#FFF',
    fontWeight: '800',
  },
  weeksRow: {
    gap: 10,
    paddingRight: 4,
  },
  weekCol: {
    width: 112,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 12,
  },
  weekColSelected: {
    backgroundColor: '#F8FAFC',
  },
  weekNameText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 6,
  },
  weekNameTextSelected: {
    color: '#10B981',
    fontWeight: '900',
  },
  weekRangePill: {
    minWidth: 72,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  weekRangePillSelected: {
    backgroundColor: '#10B981',
  },
  weekRangeText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
  },
  weekRangeTextSelected: {
    color: '#FFF',
  },
  earningsDashboard: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
  },
  dashboardLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  dashboardValue: {
    fontSize: 38,
    fontWeight: '900',
    color: '#10B981', // Grab style positive green
    marginTop: 14,
    marginBottom: 8,
  },
  weeklyChart: {
    width: '100%',
    height: 156,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  weeklyBarCol: {
    alignItems: 'center',
    width: 38,
    position: 'relative',
  },
  weeklyBarTrack: {
    width: 28,
    height: 92,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  weeklyBar: {
    width: 24,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  weeklyBarLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tooltipContainer: {
    alignItems: 'center',
    marginBottom: 2,
    position: 'absolute',
    bottom: 116,
    zIndex: 10,
    width: 60,
  },
  tooltipBubble: {
    backgroundColor: '#1E293B',
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  tooltipText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1E293B',
  },
  walletBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  walletBalanceLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  walletBalanceValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  withdrawCardButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginTop: 6,
  },
  withdrawCardButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  ridesSummaryHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  ridesSummaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  jobsListContainer: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyJobsText: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  jobItemRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  jobTimeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  jobPickupText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
  },
  paymentMethodBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentMethodBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
  promoBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  promoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  jobItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobEarningsAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cancelledTextLabel: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '700',
  },
  
  // MODAL SLIDE UP STYLES (Ảnh 2 / 1)
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: {
    padding: 4,
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  modalDistanceText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 12,
  },
  modalRouteCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
  },
  modalRouteIconCol: {
    width: 20,
    alignItems: 'center',
    marginTop: 6,
  },
  pickupDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  routeLineConnector: {
    width: 1.5,
    height: 52,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  modalRouteAddressCol: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabelHeader: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  addressLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  detailTagsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  modalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modalTagText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  modalEarningsSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  modalEarningsTitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  modalEarningsVal: {
    fontSize: 34,
    fontWeight: '900',
    color: '#10B981',
    marginTop: 4,
  },
  accordionContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLeftLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  detailRightVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  totalIncomeLabel: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '800',
  },
  totalIncomeVal: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '900',
  },
  feedbackPassengerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  starsSubtext: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  closePopupBtn: {
    height: 52,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  closePopupBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
  }
});
