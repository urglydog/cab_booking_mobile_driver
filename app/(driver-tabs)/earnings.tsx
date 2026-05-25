import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, ArrowUpRight, ChevronRight, X, HelpCircle, MapPin, Bike, Car, ChevronDown, ChevronUp, Star, Calendar } from 'lucide-react-native';
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
  
  // Custom expandable accordions for the detail panel
  const [expandedSections, setExpandedSections] = useState({
    income: true,
    payment: false,
    fees: false,
    feedback: true,
  });

  const [selectedDateIndex, setSelectedDateIndex] = useState(5); // Default to current day index in mock calendar

  // Mock Calendar Dates for visual display (matching Screenshot 3)
  const mockCalendar = [
    { dayName: 'Th 4', date: '20', isToday: false },
    { dayName: 'Th 5', date: '21', isToday: false },
    { dayName: 'Th 6', date: '22', isToday: false },
    { dayName: 'Th 7', date: '23', isToday: false },
    { dayName: 'CN', date: '24', isToday: false },
    { dayName: 'Th 2', date: '25', isToday: true }, // Current active day
  ];

  const fetchEarningsAndJobs = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch completed simulated jobs from AsyncStorage
      const storedJobsJson = await AsyncStorage.getItem('driver_completed_jobs');
      let localJobs: CompletedJob[] = storedJobsJson ? JSON.parse(storedJobsJson) : [];

      // Filter out seed files
      localJobs = localJobs.filter(j => j && j.id && !j.id.startsWith('booking-seed-'));

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
      localJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Ensure some mock items exist if empty so the user always has beautiful data to review (matching images)
      if (localJobs.length === 0) {
        localJobs = [
          // May 25 (Today)
          {
            id: 'D-99XKA1082HA',
            customerName: 'Lê Minh',
            pickupLocation: 'Cảng Sài Gòn - Cảng Hành Khách Tàu Biển',
            dropoffLocation: 'Cổng Đón/Trả Khách Ga Quốc Tế',
            estimatedFare: 33000,
            createdAt: '2026-05-25T11:45:00.000Z', // matches '25'
            paymentMethod: 'CARD',
            distance: '3.8 km'
          },
          // May 24
          {
            id: 'C-89XJA1029AJ',
            customerName: 'Bùi Đình Túy',
            pickupLocation: 'Cháo Sườn Phong - Bùi Đình Túy',
            dropoffLocation: 'Chợ Bà Chiểu, Bình Thạnh',
            estimatedFare: 39337,
            createdAt: '2026-05-24T08:30:00.000Z', // matches '24'
            paymentMethod: 'CASH',
            distance: '5.1 km'
          },
          // May 23
          {
            id: 'H-89XJF1023AJ',
            customerName: 'Nguyễn Thị Minh Khai',
            pickupLocation: 'Công viên Tao Đàn',
            dropoffLocation: 'Dinh Độc Lập',
            estimatedFare: 25000,
            createdAt: '2026-05-23T10:05:00.000Z', // matches '23'
            paymentMethod: 'CARD',
            distance: '1.2 km'
          },
          // May 22 (Matches Screenshot 3)
          {
            id: 'A-9CEDX7EGW8JQ',
            customerName: 'Nguyễn Thoại',
            pickupLocation: 'Hoff Specialty Coffee',
            dropoffLocation: '72 Đường Số 2 - KDC Khang An',
            estimatedFare: 97900,
            createdAt: '2026-05-22T22:58:00.000Z', // matches '22'
            paymentMethod: 'CARD',
            distance: '13.70 km'
          },
          {
            id: 'B-77A91280XJAQ',
            customerName: 'Trần Hùng',
            pickupLocation: 'WALLACE - Burger & Chicken - 515 Phan Văn Trị',
            dropoffLocation: 'Hẻm 44 Đường Số 8, Gò Vấp',
            estimatedFare: 35248,
            createdAt: '2026-05-22T21:01:00.000Z', // matches '22'
            paymentMethod: 'CARD',
            distance: '4.2 km'
          },
          {
            id: 'E-CANCELLED-992',
            customerName: 'Huỳnh Tấn Phát',
            pickupLocation: 'Trà sữa & Chè khúc bạch AZ - 539 Huỳnh Tấn Phát',
            dropoffLocation: 'Lâm Văn Bền, Quận 7',
            estimatedFare: 35000,
            createdAt: '2026-05-22T09:01:00.000Z', // matches '22'
            status: 'CANCELLED',
            paymentMethod: 'CARD',
            distance: '0 km'
          },
          // May 21
          {
            id: 'G-89XJE1021AJ',
            customerName: 'Võ Văn Kiệt',
            pickupLocation: 'Hầm Thủ Thiêm, Quận 1',
            dropoffLocation: 'Khu dân cư Sala, Quận 2',
            estimatedFare: 45000,
            createdAt: '2026-05-21T16:10:00.000Z', // matches '21'
            paymentMethod: 'CASH',
            distance: '3.2 km'
          },
          // May 20
          {
            id: 'F-89XJD1020AJ',
            customerName: 'Phạm Văn Đồng',
            pickupLocation: 'Gigamall Phạm Văn Đồng',
            dropoffLocation: 'Landmark 81, Bình Thạnh',
            estimatedFare: 110000,
            createdAt: '2026-05-20T14:20:00.000Z', // matches '20'
            paymentMethod: 'CARD',
            distance: '8.5 km'
          }
        ];
        // Save the fallbacks to Storage so they are persistent
        await AsyncStorage.setItem('driver_completed_jobs', JSON.stringify(localJobs));
      }

      setJobs(localJobs);

      // Compute Net balance (driver takes 70% net from completed rides)
      const computedEarnings = localJobs.reduce((sum, job) => {
        if (job.status === 'CANCELLED') return sum;
        return sum + (job.estimatedFare || 0) * 0.70;
      }, 0);

      setNetBalance(Math.round(computedEarnings));
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

  const handleWithdraw = () => {
    if (netBalance === 0) {
      Alert.alert('Không thể rút tiền', 'Số dư ví thu nhập của bạn hiện đang bằng 0đ.');
      return;
    }
    Alert.alert(
      'Rút tiền về Ngân hàng',
      `Bạn có muốn rút toàn bộ thu nhập thực nhận ${netBalance.toLocaleString()}đ về tài khoản ngân hàng không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'XÁC NHẬN RÚT', 
          onPress: async () => {
            setLoading(true);
            setTimeout(async () => {
              // Flush storage
              const resetJobsArray = jobs.map(j => ({ ...j, estimatedFare: 0 }));
              await AsyncStorage.setItem('driver_completed_jobs', JSON.stringify(resetJobsArray));
              await AsyncStorage.setItem('driver_earnings', '0');
              setNetBalance(0);
              setJobs(resetJobsArray);
              setLoading(false);
              Alert.alert('Thành công', 'Tiền đã được gửi về ngân hàng liên kết của bạn trong vòng 5 phút!');
            }, 1000);
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
    const selectedDayStr = mockCalendar[selectedDateIndex].date; // '20', '21', '22', etc.
    return jobs.filter(job => {
      try {
        const date = new Date(job.createdAt);
        const dayStr = String(date.getDate()).padStart(2, '0');
        return dayStr === selectedDayStr;
      } catch (err) {
        return false;
      }
    });
  };

  const filteredJobs = getFilteredJobs();
  const dailyNetEarnings = filteredJobs.reduce((sum, job) => {
    if (job.status === 'CANCELLED') return sum;
    return sum + (job.estimatedFare || 0) * 0.70;
  }, 0);

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
            <Text style={styles.monthText}>tháng 5</Text>
            <View style={styles.periodTabs}>
              <TouchableOpacity style={styles.periodTabActive}>
                <Text style={styles.periodTabTextActive}>HẰNG NGÀY</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.periodTab}>
                <Text style={styles.periodTabText}>HẰNG TUẦN</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.daysRow}>
            {mockCalendar.map((item, index) => {
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
        </View>

        {/* Large Net Earnings Display (Ảnh 1 / 2) */}
        <View style={styles.earningsDashboard}>
          <Text style={styles.dashboardLabel}>Thu nhập ngày {mockCalendar[selectedDateIndex].date} thg 5</Text>
          <Text style={styles.dashboardValue}>đ{Math.round(dailyNetEarnings).toLocaleString()}</Text>
          
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
            {filteredJobs.filter(j => j.status !== 'CANCELLED').length} cuốc xe đã hoàn thành
          </Text>
        </View>

        {/* Completed Ride List (Ảnh 3) */}
        <View style={styles.jobsListContainer}>
          {filteredJobs.map((item) => {
            const isCancelled = item.status === 'CANCELLED';
            const rideNet = isCancelled ? 0 : Math.round(item.estimatedFare * 0.70);
            
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
            } catch (e) {}

            return (
              <TouchableOpacity 
                key={item.id} 
                style={styles.jobItemRow}
                activeOpacity={0.7}
                onPress={() => setSelectedJob(item)}
              >
                <View style={styles.jobItemLeft}>
                  <Text style={styles.jobTimeText}>{timeString}</Text>
                  <Text style={styles.jobPickupText} numberOfLines={1}>
                    {item.pickupLocation}
                  </Text>
                  
                  {/* Badges */}
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
                </View>

                <View style={styles.jobItemRight}>
                  {isCancelled ? (
                    <Text style={styles.cancelledTextLabel}>Đã Hủy</Text>
                  ) : (
                    <Text style={styles.jobEarningsAmount}>
                      {rideNet.toLocaleString()}
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
              <Text style={styles.modalDistanceText}>
                {selectedJob.distance || '13.70 km'}
              </Text>

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
                      <Text style={styles.detailRightVal} style={{ color: '#EF4444' }}>
                        -{Math.round(selectedJob.estimatedFare * 0.30).toLocaleString()}đ
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
                    <Text style={styles.feedbackPassengerName}>{selectedJob.customerName}</Text>
                    <View style={styles.starsRow}>
                      <Star size={24} color="#F59E0B" fill="#F59E0B" style={{ marginHorizontal: 2 }} />
                      <Star size={24} color="#F59E0B" fill="#F59E0B" style={{ marginHorizontal: 2 }} />
                      <Star size={24} color="#F59E0B" fill="#F59E0B" style={{ marginHorizontal: 2 }} />
                      <Star size={24} color="#F59E0B" fill="#F59E0B" style={{ marginHorizontal: 2 }} />
                      <Star size={24} color="#F59E0B" fill="#F59E0B" style={{ marginHorizontal: 2 }} />
                    </View>
                    <Text style={styles.starsSubtext}>Khách hàng rất lịch sự & thân thiện</Text>
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
