import Button, { BtnSizes, BtnTypes } from '@celo/react-components/components/Button.v2'
import ItemSeparator from '@celo/react-components/components/ItemSeparator'
import SectionHead from '@celo/react-components/components/SectionHeadGold'
import colors from '@celo/react-components/styles/colors.v2'
import fontStyles from '@celo/react-components/styles/fonts.v2'
import variables from '@celo/react-components/styles/variables'
import { useNavigation } from '@react-navigation/native'
import { StackScreenProps } from '@react-navigation/stack'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import SafeAreaView from 'react-native-safe-area-view'
import { useDispatch } from 'react-redux'
import CeloAnalytics from 'src/analytics/CeloAnalytics'
import { CustomEventNames } from 'src/analytics/constants'
import { fetchExchangeRate } from 'src/exchange/actions'
import CeloGoldHistoryChart from 'src/exchange/CeloGoldHistoryChart'
import CeloGoldOverview from 'src/exchange/CeloGoldOverview'
import { useExchangeRate } from 'src/exchange/hooks'
import { exchangeHistorySelector } from 'src/exchange/reducer'
import { CURRENCY_ENUM } from 'src/geth/consts'
import { Namespaces } from 'src/i18n'
import { LocalCurrencyCode } from 'src/localCurrency/consts'
import { convertDollarsToLocalAmount } from 'src/localCurrency/convert'
import { getLocalCurrencyExchangeRate } from 'src/localCurrency/selectors'
import DrawerTopBar from 'src/navigator/DrawerTopBar'
import { Screens } from 'src/navigator/Screens'
import { StackParamList } from 'src/navigator/types'
import useSelector from 'src/redux/useSelector'
import DisconnectBanner from 'src/shared/DisconnectBanner'
import TransactionsList from 'src/transactions/TransactionsList'
import { goldToDollarAmount } from 'src/utils/currencyExchange'
import { getLocalCurrencyDisplayValue } from 'src/utils/formatting'

type OwnProps = StackScreenProps<StackParamList, Screens.ExchangeHomeScreen>

type Props = OwnProps

function ExchangeHomeScreen(_props: Props) {
  const animatedValue = useRef(new Animated.Value(0)).current
  const navigation = useNavigation()
  const { t } = useTranslation(Namespaces.exchangeFlow9)
  const dollarBalance = useSelector((state) => state.stableToken.balance)
  const goldBalance = useSelector((state) => state.goldToken.balance)
  const dispatch = useDispatch()
  const [isScrolled, setIsScrolled] = useState(false)

  // TODO: revert this back to `useLocalCurrencyCode()` when we have history data for cGDL to Local Currency.
  const localCurrencyCode = null
  const localExchangeRate = useSelector(getLocalCurrencyExchangeRate)
  const currentExchangeRate = useExchangeRate()
  const goldToDollars = useCallback((amount) => goldToDollarAmount(amount, currentExchangeRate), [
    currentExchangeRate,
  ])
  const dollarsToLocal = useCallback(
    (amount) => convertDollarsToLocalAmount(amount, localCurrencyCode ? localExchangeRate : 1),
    [localExchangeRate]
  )
  const displayLocalCurrency = useCallback(
    (amount: BigNumber.Value) =>
      getLocalCurrencyDisplayValue(amount, localCurrencyCode || LocalCurrencyCode.USD, true),
    [localCurrencyCode]
  )

  const currentGoldRateInLocalCurrency = dollarsToLocal(goldToDollars(1))
  let rateChangeInPercentage, rateWentUp
  const exchangeHistory = useSelector(exchangeHistorySelector)
  if (exchangeHistory.aggregatedExchangeRates.length) {
    const oldestGoldRateInLocalCurrency = dollarsToLocal(
      exchangeHistory.aggregatedExchangeRates[0].exchangeRate
    )
    if (oldestGoldRateInLocalCurrency) {
      const rateChange = currentGoldRateInLocalCurrency?.minus(oldestGoldRateInLocalCurrency)
      rateChangeInPercentage = currentGoldRateInLocalCurrency
        ?.div(oldestGoldRateInLocalCurrency)
        .minus(1)
        .multipliedBy(100)
      rateWentUp = rateChange?.gt(0)
    }
  }

  const hasGold = new BigNumber(goldBalance || 0).isGreaterThan(0)

  useEffect(() => {
    dispatch(fetchExchangeRate())
  }, [])

  const headerOpacity = useCallback(
    () => ({
      opacity: animatedValue.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 1],
        extrapolate: Animated.Extrapolate.CLAMP,
      }),
    }),
    []
  )

  const goToBuyGold = useCallback(() => {
    CeloAnalytics.track(CustomEventNames.gold_buy_start)
    navigation.navigate(Screens.ExchangeTradeScreen, {
      makerTokenDisplay: {
        makerToken: CURRENCY_ENUM.DOLLAR,
        makerTokenBalance: dollarBalance || '0',
      },
    })
  }, [dollarBalance])

  const goToBuyDollars = useCallback(() => {
    CeloAnalytics.track(CustomEventNames.gold_sell_start)
    navigation.navigate(Screens.ExchangeTradeScreen, {
      makerTokenDisplay: {
        makerToken: CURRENCY_ENUM.GOLD,
        makerTokenBalance: goldBalance || '0',
      },
    })
  }, [dollarBalance])

  const onScroll = useCallback(
    Animated.event(
      [
        {
          nativeEvent: {
            contentOffset: {
              y: (y: Animated.Node<number>) =>
                Animated.block([
                  Animated.set(animatedValue, y),
                  Animated.call([y], ([offsetY]) => {
                    setIsScrolled(offsetY > 0)
                  }),
                ]),
            },
          },
        },
      ],
      {
        useNativeDriver: true,
      }
    ),
    []
  )
  return (
    <SafeAreaView style={styles.background}>
      <DrawerTopBar
        showBottomBorder={isScrolled}
        middleElement={
          <Animated.View style={[styles.header, headerOpacity()]}>
            {currentGoldRateInLocalCurrency && (
              <Text style={styles.goldPriceCurrentValueHeader}>
                {getLocalCurrencyDisplayValue(
                  currentGoldRateInLocalCurrency,
                  LocalCurrencyCode.USD,
                  true
                )}
              </Text>
            )}
            {rateChangeInPercentage && (
              <Text
                style={rateWentUp ? styles.goldPriceWentUpHeader : styles.goldPriceWentDownHeader}
              >
                {rateWentUp ? '▴' : '▾'} {rateChangeInPercentage.toFormat(2)}%
              </Text>
            )}
          </Animated.View>
        }
      />
      <Animated.ScrollView
        scrollEventThrottle={50}
        onScroll={onScroll}
        // style={styles.background}
        testID="ExchangeScrollView"
        stickyHeaderIndices={[]}
        contentContainerStyle={styles.contentContainer}
      >
        <DisconnectBanner />
        <View style={styles.goldPrice}>
          <View>
            <Text style={styles.goldPriceTitle}>{t('goldPrice')}</Text>
          </View>
          <View style={styles.goldPriceValues}>
            <Text style={styles.goldPriceCurrentValue}>
              {currentGoldRateInLocalCurrency
                ? displayLocalCurrency(currentGoldRateInLocalCurrency)
                : '-'}
            </Text>

            {rateChangeInPercentage && (
              <Text style={rateWentUp ? styles.goldPriceWentUp : styles.goldPriceWentDown}>
                {rateWentUp ? '▴' : '▾'} {rateChangeInPercentage.toFormat(2)}%
              </Text>
            )}
          </View>
        </View>

        <CeloGoldHistoryChart />
        <View style={styles.buttonContainer}>
          <Button
            text={t('buy')}
            size={BtnSizes.FULL}
            onPress={goToBuyGold}
            style={styles.button}
            type={BtnTypes.TERTIARY}
          />
          {hasGold && (
            <Button
              size={BtnSizes.FULL}
              text={t('sell')}
              onPress={goToBuyDollars}
              style={styles.button}
              type={BtnTypes.TERTIARY}
            />
          )}
        </View>
        <ItemSeparator />
        <CeloGoldOverview testID="ExchangeAccountOverview" />
        <ItemSeparator />
        <SectionHead text={t('global:activity')} />
        <TransactionsList currency={CURRENCY_ENUM.GOLD} />
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

export default ExchangeHomeScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
  },
  exchangeEvent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  background: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'space-between',
  },
  buttonContainer: {
    flexDirection: 'row',
    flex: 1,
    marginTop: 24,
    marginBottom: 28,
    marginHorizontal: 12,
  },
  button: {
    marginHorizontal: 4,
    flex: 1,
  },
  head: {
    backgroundColor: colors.background,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 62,
  },
  hamburger: {
    position: 'absolute',
    left: 0,
  },
  goldPrice: {
    padding: variables.contentPadding,
  },
  goldPriceTitle: {
    ...fontStyles.h2,
    marginBottom: 8,
  },
  goldPriceValues: { flexDirection: 'row', alignItems: 'flex-end' },
  goldPriceCurrentValue: {
    height: 27,
    ...fontStyles.mediumNumber,
  },
  goldPriceCurrentValueHeader: {
    ...fontStyles.regular500,
  },
  goldPriceWentUp: {
    ...fontStyles.regular,
    color: colors.greenUI,
  },
  goldPriceWentDown: {
    ...fontStyles.regular,
    marginBottom: 2, // vertically align with the current price
    marginLeft: 4,
    color: colors.warning,
  },
  goldPriceWentUpHeader: {
    ...fontStyles.small600,
    color: colors.celoGreen,
  },
  goldPriceWentDownHeader: {
    ...fontStyles.small600,
    color: colors.warning,
  },
})
