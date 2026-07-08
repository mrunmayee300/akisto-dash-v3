function doGet(e) {
    initializeAuthSheets();

    var action = (e && e.parameter && e.parameter.action) || "dashboard";
  
    // ====================================
    // CHECK COMPANY API
    // ====================================
    if (action === "checkCompany") {
      var companyName = e && e.parameter && e.parameter.companyName;
      var clients = getClientMapping();
      var foundClient = clients.find(function(c) {
        var name1 = normalize(c.client_company_name).toLowerCase();
        var name2 = normalize(c.company_name).toLowerCase();
        var name3 = normalize(c.client_company_name_full).toLowerCase();
        var inputName = normalize(companyName).toLowerCase();
        return (name1 && name1 === inputName) || 
               (name2 && name2 === inputName) || 
               (name3 && name3 === inputName) ||
               (name1 && name1.indexOf(inputName) !== -1) ||
               (name3 && name3.indexOf(inputName) !== -1);
      });
      
      var result = {
        success: !!foundClient,
        companyName: foundClient ? (foundClient.client_company_name || foundClient.company_name || foundClient.client_company_name_full) : null
      };
      
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ====================================
    // LOGIN API
    // ====================================
    if (action === "login") {
      var companyName = e && e.parameter && e.parameter.companyName;
      var email = e && e.parameter && e.parameter.email;
      var password = e && e.parameter && e.parameter.password;
      
      var clients = getClientMapping();
      var foundClient = clients.find(function(c) {
        var name1 = normalize(c.client_company_name).toLowerCase();
        var name2 = normalize(c.company_name).toLowerCase();
        var name3 = normalize(c.client_company_name_full).toLowerCase();
        var inputName = normalize(companyName).toLowerCase();
        return (name1 && name1 === inputName) || 
               (name2 && name2 === inputName) || 
               (name3 && name3 === inputName) ||
               (name1 && name1.indexOf(inputName) !== -1) ||
               (name3 && name3.indexOf(inputName) !== -1);
      });
      
      if (!foundClient) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: "Company not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var clientCode = foundClient.client_code;
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var userSheet = ss.getSheetByName("Users");
      var users = getObjects(userSheet);
      
      var hashedPassword = hashPassword(password);
      
      var foundUser = users.find(function(u) {
        var uEmail = normalize(u.email).toLowerCase();
        var inputEmail = normalize(email).toLowerCase();
        if (uEmail !== inputEmail) return false;
        
        var uPass = normalize(u.password_hash || u.password || u.password_hash_);
        var passMatch = (uPass === hashedPassword) || (uPass === normalize(password));
        
        var uClient = normalize(u.client_code);
        var clientMatch = (uClient === normalize(clientCode));
        
        var uActive = normalize(u.active).toUpperCase();
        var activeMatch = (uActive === "TRUE" || uActive === "YES" || uActive === "Y" || uActive === "1" || uActive === "");
        
        return passMatch && clientMatch && activeMatch;
      });
      
      if (!foundUser) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: "Invalid email, password, or company combination" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var token = Utilities.getUuid();
      var expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      
      var sessionSheet = ss.getSheetByName("Sessions");
      sessionSheet.appendRow([token, email, clientCode, expiry.toISOString()]);
      
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          token: token,
          email: email,
          role: foundUser.role,
          userName: foundUser['User Name'] || foundUser.userName || '',
          userRole: foundUser['Role'] || foundUser.userRole || '',
          companyName: foundClient.client_company_name || foundClient.company_name || foundClient.client_company_name_full
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ====================================
    // SESSION VERIFICATION
    // ====================================
    var sessionToken = e && e.parameter && e.parameter.sessionToken;
    var session = getSession(sessionToken);
    if (!session) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Unauthorized", message: "Invalid or expired session" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var clientCode = session.client_code;

    // ====================================
    // PO DETAILS API
    // ====================================
  
    if (action === "poDetails") {
      var commsGroupId = e && e.parameter && e.parameter.commsGroupId;
      var result = getPODetails(commsGroupId, clientCode);
  
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ====================================
    // SUPPLIER PERFORMANCE API
    // ====================================
    if (action === "supplierPerformance") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var statsSheet = ss.getSheetByName("Supplier Stats");
      var monthlySheet = ss.getSheetByName("Supplier Monthly Stats");
      var delaySheet = ss.getSheetByName("Delay Event Logs");
      var clientStatsSheet = ss.getSheetByName("Client Stats");

      var stats = getObjects(statsSheet);
      var monthly = getObjects(monthlySheet);
      var delays = getObjects(delaySheet);
      var clientStats = getObjects(clientStatsSheet);

      // Filter by client code
      var filteredStats = stats.filter(function(s) {
        return normalize(s.client_code) === normalize(clientCode);
      });

      var suppliers = filteredStats.map(function(s) {
        var rawOnTime = parseFloat(s.on_time_rate || 0);
        var isWholeNumber = rawOnTime > 1.5;
        var onTimeRate = isWholeNumber ? (rawOnTime / 100) : rawOnTime;
        var escalatedRate = isWholeNumber ? (parseFloat(s.escalated_rate || 0) / 100) : parseFloat(s.escalated_rate || 0);

        var rateClass = onTimeRate < 0.6 ? 'bad' : (onTimeRate < 0.8 ? 'mid' : 'good');
        return {
          name: s.supplier_name || s.supplier_name_full || 'Unknown Supplier',
          code: s.supplier_code,
          desc: s.category || '',
          poLines: parseInt(s.total_po_lines || 0, 10),
          onTime: Math.round(onTimeRate * 100),
          avgDaysLate: parseFloat(s.avg_days_late || 0).toFixed(1),
          avgRespTime: parseFloat(s.avg_response_time_days || 0).toFixed(1) + ' d',
          escalated: Math.round(escalatedRate * 100) + '%',
          flag: s.performance_flag || '',
          rateClass: rateClass
        };
      });

      suppliers.sort(function(a, b) { return b.onTime - a.onTime; });

      var totalPoLines = 0, totalOnTimeLines = 0, totalEscalatedLines = 0;
      filteredStats.forEach(function(s) {
        totalPoLines += parseInt(s.total_po_lines || 0, 10);
        totalOnTimeLines += parseInt(s.on_time_lines || 0, 10);
        totalEscalatedLines += parseInt(s.escalated_lines || 0, 10);
      });

      var formatMonth = function(monthVal) {
        if (!monthVal) return '';
        var str = String(monthVal).trim();
        if (/^\d{4}-\d{2}$/.test(str)) {
          return str;
        }
        var d = new Date(str);
        if (!isNaN(d.getTime())) {
          var y = d.getFullYear();
          var m = String(d.getMonth() + 1);
          if (m.length === 1) m = "0" + m;
          return y + "-" + m;
        }
        return str;
      };

      var trendData = monthly
        .filter(function(row) {
          return normalize(row.client_code) === normalize(clientCode) && normalize(row.supplier_code) === 'GLOBAL';
        })
        .map(function(row) {
          var rawRate = parseFloat(row.on_time_rate || 0);
          var rate = rawRate > 1.5 ? (rawRate / 100) : rawRate;
          return {
            month: formatMonth(row.month),
            rate: Math.round(rate * 100)
          };
        });
      trendData.sort(function(a, b) { return normalize(a.month).localeCompare(normalize(b.month)); });

      if (trendData.length > 0) {
        var latestMonth = trendData.reduce(function(max, d) { return d.month > max ? d.month : max; }, '0000-00');
        var thresholdMonth = getThresholdMonth(latestMonth, 6);
        trendData = trendData.filter(function(d) { return d.month >= thresholdMonth; });
      }

      // Filter Delay Summary dynamically (GLOBAL causes)
      var filteredDelays = delays.filter(function(row) {
        return normalize(row.client_code) === normalize(clientCode);
      });
      var totalDelays = filteredDelays.length;
      var delayCounts = {};
      var delaySides = {};
      filteredDelays.forEach(function(row) {
        var cat = row.delay_reason_category || 'Unknown';
        delayCounts[cat] = (delayCounts[cat] || 0) + 1;
        delaySides[cat] = row.delay_origin || 'supplier';
      });
      var delaySummary = Object.keys(delayCounts).map(function(cat) {
        return {
          category: cat,
          side: delaySides[cat],
          count: delayCounts[cat],
          percentage: totalDelays > 0 ? Math.round((delayCounts[cat] / totalDelays) * 100) : 0
        };
      });
      delaySummary.sort(function(a, b) { return b.percentage - a.percentage; });

      var foundClientStat = clientStats.find(function(cs) {
        return normalize(cs.client_code) === normalize(clientCode);
      });

      var result = {
        success: true,
        suppliers: suppliers,
        kpis: {
          onTimeRate: totalPoLines > 0 ? Math.round((totalOnTimeLines / totalPoLines) * 100) : 100,
          escalatedRate: totalPoLines > 0 ? Math.round((totalEscalatedLines / totalPoLines) * 100) : 0,
          onTimeRateDelta: foundClientStat ? parseFloat(foundClientStat.client_otr_6months || 0) : 0,
          escalatedRateDelta: foundClientStat ? parseFloat(foundClientStat.client_escalation_6months || 0) : 0,
          totalPoLines: totalPoLines,
          supplierCount: filteredStats.length
        },
        trendData: trendData,
        delaySummary: delaySummary
      };

      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ====================================
    // SUPPLIER DETAIL API
    // ====================================
    if (action === "supplierDetail") {
      var supplierCode = e && e.parameter && e.parameter.supplierCode;
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var statsSheet = ss.getSheetByName("Supplier Stats");
      var monthlySheet = ss.getSheetByName("Supplier Monthly Stats");
      var delaySheet = ss.getSheetByName("Delay Event Logs");
      var commSheet = ss.getSheetByName("Communication Logs");

      var stats = getObjects(statsSheet);
      var monthly = getObjects(monthlySheet);
      var delays = getObjects(delaySheet);
      var comms = getObjects(commSheet);

      var foundStats = stats.find(function(s) {
        return normalize(s.client_code) === normalize(clientCode) && normalize(s.supplier_code) === normalize(supplierCode);
      });

      if (!foundStats) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: "Supplier stats not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var rawOnTime = parseFloat(foundStats.on_time_rate || 0);
      var isWholeNumber = rawOnTime > 1.5;
      var onTimeRate = isWholeNumber ? (rawOnTime / 100) : rawOnTime;
      var escalatedRate = isWholeNumber ? (parseFloat(foundStats.escalated_rate || 0) / 100) : parseFloat(foundStats.escalated_rate || 0);

      var kpis = {
        onTimeRate: Math.round(onTimeRate * 100) + '%',
        onTimeRateDelta: parseFloat(foundStats.supplier_otr_6months || 0),
        avgDaysLate: parseFloat(foundStats.avg_days_late || 0).toFixed(1),
        avgRespTime: parseFloat(foundStats.avg_response_time_days || 0).toFixed(1) + ' d',
        escalatedRate: Math.round(escalatedRate * 100) + '%',
        escalatedRateDelta: parseFloat(foundStats.supplier_escalation_6months || 0)
      };

      var formatMonth = function(monthVal) {
        if (!monthVal) return '';
        var str = String(monthVal).trim();
        if (/^\d{4}-\d{2}$/.test(str)) {
          return str;
        }
        var d = new Date(str);
        if (!isNaN(d.getTime())) {
          var y = d.getFullYear();
          var m = String(d.getMonth() + 1);
          if (m.length === 1) m = "0" + m;
          return y + "-" + m;
        }
        return str;
      };

      var trendData = monthly
        .filter(function(row) {
          return normalize(row.client_code) === normalize(clientCode) && normalize(row.supplier_code) === normalize(supplierCode);
        })
        .map(function(row) {
          var rawRate = parseFloat(row.on_time_rate || 0);
          var rate = rawRate > 1.5 ? (rawRate / 100) : rawRate;
          return {
            month: formatMonth(row.month),
            rate: Math.round(rate * 100)
          };
        });
      trendData.sort(function(a, b) { return normalize(a.month).localeCompare(normalize(b.month)); });

      if (trendData.length > 0) {
        var latestMonth = trendData.reduce(function(max, d) { return d.month > max ? d.month : max; }, '0000-00');
        var thresholdMonth = getThresholdMonth(latestMonth, 6);
        trendData = trendData.filter(function(d) { return d.month >= thresholdMonth; });
      }

      // Delay Summary dynamically (supplier-specific causes)
      var filteredDelays = delays.filter(function(row) {
        return normalize(row.client_code) === normalize(clientCode) && normalize(row.supplier_code) === normalize(supplierCode);
      });
      var totalDelays = filteredDelays.length;
      var delayCounts = {};
      var delaySides = {};
      filteredDelays.forEach(function(row) {
        var cat = row.delay_reason_category || 'Unknown';
        delayCounts[cat] = (delayCounts[cat] || 0) + 1;
        delaySides[cat] = row.delay_origin || 'supplier';
      });
      var delaySummary = Object.keys(delayCounts).map(function(cat) {
        return {
          category: cat,
          side: delaySides[cat],
          count: delayCounts[cat],
          percentage: totalDelays > 0 ? Math.round((delayCounts[cat] / totalDelays) * 100) : 0
        };
      });
      delaySummary.sort(function(a, b) { return b.percentage - a.percentage; });

      // Recent Deliveries from Communication Logs
      var recentDeliveries = comms
        .filter(function(log) {
          return normalize(log.client_code) === normalize(clientCode) && 
                 normalize(log.supplier_code) === normalize(supplierCode) && 
                 normalize(log['PO line item status']).toLowerCase() === 'closed';
        })
        .map(function(log) {
          var variance = parseInt(log.delivery_variance_days || 0, 10);
          var deliveryDate = log.stage3_reply_timestamp || 
                             log.stage2_5_reply_timestamp || 
                             log.stage2_reply_timestamp || 
                             log.stage1_5_reply_timestamp || 
                             log.stage1_reply_timestamp || 
                             '';
          return {
            po: log.po_number || '--',
            materialName: log.material_name || '--',
            materialCode: log.material_code || '',
            needBy: log.deliver_by_date || '',
            delivered: deliveryDate,
            daysLate: variance,
            outcome: variance <= 0 ? 'On time' : 'Delayed',
            commsGroupId: log.comms_group_id || ''
          };
        });

      recentDeliveries.sort(function(a, b) { return new Date(b.needBy) - new Date(a.needBy); });

      var result = {
        success: true,
        supplierMeta: {
          name: foundStats.supplier_name || foundStats.supplier_name_full || 'Unknown',
          code: foundStats.supplier_code,
          cat: foundStats.total_po_lines + ' PO lines over the trailing 6 months',
          flag: foundStats.performance_flag || '',
          contact: foundStats.contact_name || '--',
          email: foundStats.email || '--',
          phone: foundStats.phone || '--',
          location: foundStats.source_location || '--'
        },
        kpis: kpis,
        trendData: trendData,
        delaySummary: delaySummary,
        recentDeliveries: recentDeliveries
      };

      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
  
    // ====================================
    // DASHBOARD API
    // ====================================
  
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var poSheet = ss.getSheetByName("PO consolidated data");
    var commSheet = ss.getSheetByName("Communication Logs");
  
    var poData = getObjects(poSheet);
    var commData = getObjects(commSheet);
  
    // Filter by clientCode
    if (clientCode) {
      poData = poData.filter(function(po) {
        return normalize(po.client_code) === normalize(clientCode);
      });
    }

    var commMap = {};
  
    commData.forEach(function (row) {
      commMap[row.po_line_key] = row;
    });
  
    var openPOs = [];
    var onTrack = [];
    var needsAttention = [];
    var awaitingReply = [];
  
    poData.forEach(function (po) {
      var comm = commMap[po.po_line_key] || {};
  
      // Alternative to spread operator for object merging
      var row = {};
      for (var k1 in po) {
        if (po.hasOwnProperty(k1)) row[k1] = po[k1];
      }
      for (var k2 in comm) {
        if (comm.hasOwnProperty(k2)) row[k2] = comm[k2];
      }
  
      openPOs.push(row);
  
      var stage = row.follow_up_stage || 'Stage1';
      var prefix = stage.toLowerCase().replace('.', '_') + '_';
      var classification = normalize(row[prefix + 'delivery_status_classification']);
      var classificationLower = classification.toLowerCase();
      var status = normalize(row.follow_up_status);
      var statusLower = status.toLowerCase();
  
      var needsHumanReview = normalize(row.needs_human_review).toLowerCase() === 'yes';
      var humanReviewStatus = normalize(row.human_review_status).toLowerCase() === 'pending';
      var isEscalated = statusLower === 'escalation_sent';
      var isLowConfidence = normalize(row[prefix + 'supplier_reply_confidence']).toLowerCase() === 'low';
      
      // 1. Needs Attention Bucket
      var isNeedsAttention = needsHumanReview || humanReviewStatus || isEscalated || 
                             classificationLower.indexOf('delay') !== -1 || 
                             classificationLower.indexOf('late') !== -1 ||
                             isLowConfidence;

      // 2. On Track Bucket
      var isOnTrackState = isOnTrack(row);

      // 3. Awaiting Reply Bucket
      var activeChasing = ['outreach_sent', 'reminder1_sent', 'reminder2_sent', 'reminder3_sent'].indexOf(statusLower) !== -1;
      var isClarification = status === 'Clarification_Sent';
      var isColleagueDelegated = classification === 'awaiting_reply' && normalize(row.supplier_colleague_email) !== '';
      var isPromisedRevert = classification === 'awaiting_reply' && 
                             (normalize(row.promised_revert_date) !== '' || normalize(row[prefix + 'promised_revert_date']) !== '');
      
      var isPassiveStage = ['Stage1.5', 'Stage2.5', 'stage1.5', 'stage2.5'].indexOf(stage) !== -1;
      var hasReply = normalize(row[prefix + 'reply_timestamp']) !== '' || 
                     normalize(row[prefix + 'supplier_reply_status']).toLowerCase() === 'received';
      
      var isPassiveUnclear = isPassiveStage && hasReply && !isOnTrackState && !isNeedsAttention;

      var isAwaitingReply = !isNeedsAttention && !isOnTrackState && 
                            (activeChasing || isClarification || isColleagueDelegated || isPromisedRevert || isPassiveUnclear);

       // Determine Sub-status
       var itemSubStatus = null;
       if (isNeedsAttention) {
         if (classificationLower === 'unclear') {
           itemSubStatus = 'Unclear Response';
         } else if (isLowConfidence) {
           itemSubStatus = 'Low Confidence';
         } else if (classificationLower.indexOf('delay') !== -1 || classificationLower.indexOf('late') !== -1) {
           itemSubStatus = 'Delayed';
         } else if (isEscalated) {
           itemSubStatus = 'No Response';
         } else {
           itemSubStatus = 'Needs Review';
         }
         needsAttention.push(row);
       } else if (isOnTrackState) {
         itemSubStatus = isPassiveStage ? 'Monitoring' : 'Confirmed';
         onTrack.push(row);
       } else if (isAwaitingReply) {
         if (isClarification) {
           itemSubStatus = 'Clarification in progress';
         } else if (isColleagueDelegated) {
           itemSubStatus = 'Delegated to Colleague';
         } else if (isPromisedRevert) {
           itemSubStatus = 'Promised Check Date';
         } else {
           itemSubStatus = 'Chasing Response';
         }
        awaitingReply.push(row);
      } else {
        // Default fallback to Awaiting Reply
        itemSubStatus = 'Chasing Response';
        awaitingReply.push(row);
      }
      row.sub_status = itemSubStatus;
    });
  
    var output = {
      openPOs: openPOs,
      onTrack: onTrack,
      needsAttention: needsAttention,
      awaitingReply: awaitingReply,
      generatedAt: new Date()
    };
  
    return ContentService
      .createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  /* =====================================
     COMMON HELPERS
     ===================================== */
  
  function latestClassification(row) {
    return (
      row.stage3_delivery_status_classification ||
      row.stage2_5_delivery_status_classification ||
      row.stage2_delivery_status_classification ||
      row.stage1_5_delivery_status_classification ||
      row.stage1_delivery_status_classification ||
      ""
    );
  }
  
  function isOnTrack(row) {
    var followUpStage = normalize(row.follow_up_stage);
    var status = normalize(row.follow_up_status);
    
    var stage = followUpStage || 'Stage1';
    var prefix = stage.toLowerCase().replace('.', '_') + '_';
    var classification = normalize(row[prefix + 'delivery_status_classification']);
    var classificationLower = classification.toLowerCase();
    
    var needsHumanReview = normalize(row.needs_human_review).toLowerCase() === 'yes';
    var humanReviewStatus = normalize(row.human_review_status).toLowerCase() === 'pending';
    var isEscalated = status.toLowerCase() === 'escalation_sent';
    var isLowConfidence = normalize(row[prefix + 'supplier_reply_confidence']).toLowerCase() === 'low';

    if (needsHumanReview || humanReviewStatus || isEscalated || isLowConfidence) {
      return false;
    }

    // Passive listening stage 1.5/2.5 checks
    if (['Stage1.5', 'Stage2.5', 'stage1.5', 'stage2.5'].indexOf(stage) !== -1) {
      var hasReply = normalize(row[prefix + 'reply_timestamp']) !== '' || 
                     normalize(row[prefix + 'supplier_reply_status']).toLowerCase() === 'received';
      if (!hasReply) {
        return true; // Quiet monitoring - counts as On Track before reply
      }
      // After reply received: must be confirmed on-time
      var confirmedClassifications = ['on time', 'on time tbc', 'shipped tbc'];
      return confirmedClassifications.indexOf(classificationLower) !== -1;
    }

    // Active stages check: must be confirmed on-time
    var confirmedClassifications = ['on time', 'on time tbc', 'shipped tbc'];
    return confirmedClassifications.indexOf(classificationLower) !== -1;
  }

  function latestStatusText(row) {
    return (
      row.stage3_delivery_status_text ||
      row.stage2_5_delivery_status_text ||
      row.stage2_delivery_status_text ||
      row.stage1_5_delivery_status_text ||
      row.stage1_delivery_status_text ||
      ""
    );
  }
  
  function getObjects(sheet) {
    if (!sheet) return [];
    var name = sheet.getName();
    var cacheKey = "sheet_objects_" + name;
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Fallback if parsing fails
      }
    }
    
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var data = [];
  
    for (var i = 1; i < values.length; i++) {
      var row = {};
  
      headers.forEach(function (header, index) {
        row[String(header).trim()] = values[i][index];
      });
  
      data.push(row);
    }
    
    try {
      var jsonStr = JSON.stringify(data);
      if (jsonStr.length < 90000) { // Keep safely under 100KB cache limit
        cache.put(cacheKey, jsonStr, 5); // Cache for 5 seconds
      }
    } catch (err) {
      // Fail silently if caching is not possible
    }
  
    return data;
  }
  
  function normalize(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).trim();
  }

  function getThresholdMonth(latestMonthStr, numMonths) {
    if (!latestMonthStr || !latestMonthStr.includes('-')) return '';
    var parts = latestMonthStr.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var d = new Date(year, month - (numMonths || 6), 1);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    if (m.length === 1) m = "0" + m;
    return y + "-" + m;
  }
  
  /* =====================================
     PO DETAILS API
  ===================================== */
  
  function getPODetails(commsGroupId, clientCode) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var poRows = getObjects(ss.getSheetByName("PO consolidated data"));
    var supplierRows = getObjects(ss.getSheetByName("Material and Supplier Master Data") || ss.getSheetByName("Material and Supplier Master Da"));
    var commRows = getObjects(ss.getSheetByName("Communication Logs"));
  
    var poGroup = poRows.filter(function (row) {
      return normalize(row.comms_group_id) === normalize(commsGroupId) &&
             (!clientCode || normalize(row.client_code) === normalize(clientCode));
    });
  
    if (poGroup.length === 0) {
      return {
        success: false,
        message: "PO not found or unauthorized"
      };
    }
  
    var representative = poGroup[0];
  
    var foundSupplier = supplierRows.filter(function (s) {
      return normalize(s.supplier_code) === normalize(representative.supplier_code);
    });
    var supplier = foundSupplier.length > 0 ? foundSupplier[0] : {};
  
    var foundComm = commRows.filter(function (c) {
      return normalize(c.comms_group_id) === normalize(commsGroupId);
    });
    var comm = foundComm.length > 0 ? foundComm[0] : {};
  
    return {
      success: true,
      deliveryStatusText: latestStatusText(comm),
  
      header: {
        poNumber: representative.po_number,
        commsGroupId: representative.comms_group_id,
        supplier: representative.supplier_name,
        supplierCode: representative.supplier_code,
        status: representative.po_status || "Open",
        shipByBand: representative.ship_by_band,
        followUpStage: comm.follow_up_stage,
        followUpStatus: comm.follow_up_status,
        lineItemCount: poGroup.length,
        issueDate: representative.issue_date
      },
  
      supplier: {
        supplierName: supplier.supplier_name,
        contactName: supplier.primary_contact_names,
        email: supplier.primary_emails,
        phone: supplier.primary_phones,
        workingDays: supplier.working_days,
        sourceLocation: supplier.supplier_source_location,
        deliveryLocation: supplier.delivery_location,
        buyerName: supplier.client_buyer_name,
        buyerEmail: supplier.client_buyer_email
      },
  
      lineItems: poGroup.map(function (row) {
        return {
          poLineKey: row.po_line_key,
          lineItem: row.po_line_item,
          materialCode: row.material_code,
          materialName: row.material_name,
          quantity: row.quantity,
          uom: row.unit_of_measure,
          shipBy: row.ship_by_date_delivery_1,
          deliverBy: row.deliver_by_date_delivery_1
        };
      }),
  
      timeline: buildTimeline(comm),
      replies: buildReplies(comm),
      nextAction: determineNextAction(comm),
      communication: comm
    };
  }
  
  function determineStatus(comm) {
    if (normalize(comm.needs_human_review).toLowerCase() === "yes") {
      return "Delayed";
    }
  
    var stages = ["stage3", "stage2", "stage1"];
  
    for (var i = 0; i < stages.length; i++) {
      var stage = stages[i];
      var classification = normalize(comm[stage + "_delivery_status_classification"]).toLowerCase();
  
      if (classification.indexOf("on time") !== -1) {
        return "On Track";
      }
    }
  
    return "Awaiting Reply";
  }
  
  function buildTimeline(comm) {
    var timeline = [];
  
    ["stage1", "stage2", "stage3"].forEach(function (stage) {
      if (comm[stage + "_outreach_timestamp"]) {
        timeline.push({
          type: "outreach",
          stage: stage,
          timestamp: comm[stage + "_outreach_timestamp"]
        });
      }
  
      for (var i = 1; i <= 3; i++) {
        if (comm[stage + "_reminder_mail" + i + "_timestamp"]) {
          timeline.push({
            type: "reminder" + i,
            stage: stage,
            timestamp: comm[stage + "_reminder_mail" + i + "_timestamp"]
          });
        }
      }
  
      if (comm[stage + "_reply_timestamp"]) {
        timeline.push({
          type: "reply",
          stage: stage,
          timestamp: comm[stage + "_reply_timestamp"]
        });
      }
    });
  
    return timeline;
  }
  
  function buildReplies(comm) {
    var replies = [];
  
    ["stage1", "stage2", "stage3"].forEach(function (stage) {
      var statement = comm[stage + "_supplier_raw_statement"];
  
      if (statement) {
        replies.push({
          stage: stage,
          statement: statement,
          classification: comm[stage + "_delivery_status_classification"],
          timestamp: comm[stage + "_reply_timestamp"]
        });
      }
    });
  
    return replies;
  }
  
  function determineNextAction(comm) {
    var stage = normalize(comm.follow_up_stage).toLowerCase().replace(".", "_");
  
    if (!stage) {
      return "Send Outreach";
    }
  
    var prefix = stage + "_";
  
    if (!comm[prefix + "outreach_sent"]) {
      return "Send Outreach";
    }
  
    if (!comm[prefix + "reminder_mail1_sent"]) {
      return "Reminder Email 1";
    }
  
    if (!comm[prefix + "reminder_mail2_sent"]) {
      return "Reminder Email 2";
    }
  
    if (!comm[prefix + "reminder_mail3_sent"]) {
      return "Reminder Email 3";
    }
  
    if (!comm[prefix + "reminder_call1_sent"]) {
      return "Reminder Call 1";
    }
  
    if (!comm[prefix + "internal_escalation_sent"]) {
      return "Escalate To Buyer";
    }
  
    return "Waiting";
  }

  /* =====================================
     AUTHENTICATION HELPERS
  ===================================== */


  /* this can be removed after the first creation of the sheets and users*/
  function initializeAuthSheets() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Initialize Users sheet
    var userSheet = ss.getSheetByName("Users");
    if (!userSheet) {
      userSheet = ss.insertSheet("Users");
      userSheet.appendRow(["user_id", "email", "password_hash", "client_code", "role", "active"]);
      
      // Insert default users for testing
      // Password: password123 -> SHA-256 hash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f"
      userSheet.appendRow(["1", "mrunmayeesangode@gmail.com", "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f", "C0", "Admin", "TRUE"]);
      userSheet.appendRow(["2", "mrunusangode@gmail.com", "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f", "C0", "User", "TRUE"]);
      userSheet.appendRow(["3", "bt23ece030@iiitn.ac.in", "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f", "C1", "Admin", "TRUE"]);
    }
    
    // Initialize Sessions sheet
    var sessionSheet = ss.getSheetByName("Sessions");
    if (!sessionSheet) {
      sessionSheet = ss.insertSheet("Sessions");
      sessionSheet.appendRow(["token", "email", "client_code", "expiry"]);
    }

    // Initialize Client information sheet if it doesn't exist
    var clientSheet = ss.getSheetByName("Client info") || ss.getSheetByName("Client information") || ss.getSheetByName("Client Information") || ss.getSheetByName("Clients");
    if (!clientSheet) {
      clientSheet = ss.insertSheet("Client info");
      clientSheet.appendRow(["client_code", "client_company_name_full", "client_company_name"]);
      clientSheet.appendRow(["C0", "Emerald Enterprises", "Emerald"]);
      clientSheet.appendRow(["C1", "Biotique", "Biotique"]);
      clientSheet.appendRow(["C2", "NTPC Sipat", ""]);
    }
  }

  function hashPassword(password) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
    var signature = "";
    for (var i = 0; i < digest.length; i++) {
      var byteVal = digest[i];
      if (byteVal < 0) byteVal += 256;
      var byteString = byteVal.toString(16);
      if (byteString.length == 1) byteString = "0" + byteString;
      signature += byteString;
    }
    return signature;
  }

  function getSession(token) {
    if (!token) return null;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sessionSheet = ss.getSheetByName("Sessions");
    if (!sessionSheet) return null;
    
    var sessions = getObjects(sessionSheet);
    var foundSession = sessions.find(function(s) {
      return normalize(s.token) === normalize(token);
    });
    
    if (!foundSession) return null;
    
    var expiryStr = foundSession.expiry;
    if (expiryStr) {
      var expiryDate = new Date(expiryStr);
      if (expiryDate.getTime() < new Date().getTime()) {
        return null;
      }
    }
    
    return foundSession;
  }

  function getClientMapping() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Client info") || ss.getSheetByName("Client information") || ss.getSheetByName("Client Information") || ss.getSheetByName("Clients");
    if (!sheet) return [];
    return getObjects(sheet);
  }