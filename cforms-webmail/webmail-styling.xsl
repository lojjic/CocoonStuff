<?xml version="1.0"?>

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:ft="http://apache.org/cocoon/forms/1.0#template"
	xmlns:fi="http://apache.org/cocoon/forms/1.0#instance">


	<xsl:include href="resource://org/apache/cocoon/forms/resources/forms-page-styling.xsl"/>
	<xsl:include href="resource://org/apache/cocoon/forms/resources/forms-field-styling.xsl"/>
	
	<!-- Location of the resources directory, where JS libs and icons are stored -->
	<xsl:param name="resources-uri">resources</xsl:param>
	
	<xsl:template match="head">
		<head>
			<xsl:apply-templates select="." mode="forms-page"/>
			<xsl:apply-templates select="." mode="forms-field"/>
			<xsl:apply-templates/>
		</head>
	</xsl:template>
	
	<xsl:template match="body">
		<body>
			<!--+ !!! If template with mode 'forms-page' adds text or elements
				|        template with mode 'forms-field' can no longer add attributes!!!
				+-->
			<xsl:apply-templates select="." mode="forms-page"/>
			<xsl:apply-templates select="." mode="forms-field"/>
			<xsl:apply-templates/>
		</body>
	</xsl:template>
	
	<!-- link-to-action styling: wrap value in a link that submits as if it were the specified action widget -->
	<xsl:template match="fi:field[fi:styling/@link-to-action]" priority="101">
		<!-- Find the full id of the target action widget: -->
		<xsl:variable name="actionFullId">
			<xsl:call-template name="replaceMostSpecific">
				<xsl:with-param name="into" select="@id" />
				<xsl:with-param name="with" select="fi:styling/@link-to-action" />
			</xsl:call-template>
		</xsl:variable>
		<!-- Create the link: -->
		<a href="#" onclick="forms_submitForm(this, '{$actionFullId}'); return false;" id="{@id}">
			<xsl:apply-templates select="." mode="styling"/>
			<xsl:value-of select="fi:value" />
		</a>
	</xsl:template>
	
	<!-- output fields: still apply styling -->
	<xsl:template match="fi:field[@state = 'output']" priority="100">
		<span id="{@id}">
			<xsl:apply-templates select="." mode="styling" />
			<xsl:value-of select="fi:value" />
		</span>
	</xsl:template>
	
	<!-- widgets with invisible styling; useful for when we need a widget's XML
	available for other stylings but don't want any client representation. -->
	<xsl:template match="fi:*[fi:styling/@type = 'invisible']" priority="100">
		<span id="{@id}"></span>
	</xsl:template>
	
	<!-- add class="marked" attribute if the specified booleanfield widget's value is true -->
	<xsl:template match="fi:styling/@booleanfield-as-class" mode="styling">
		<xsl:variable name="classValue">
			<xsl:call-template name="booleanfieldToClass">
				<xsl:with-param name="idString" select="." />
				<xsl:with-param name="replaceInto" select="../../@id" />
			</xsl:call-template>
		</xsl:variable>
		<xsl:if test="$classValue">
			<xsl:attribute name="class"><xsl:value-of select="$classValue" /></xsl:attribute>
		</xsl:if>
	</xsl:template>
	
	<xsl:key name="getBooleanfieldById" match="fi:booleanfield" use="@id" />
	
	<xsl:template name="booleanfieldToClass">
		<xsl:param name="idString" />
		<xsl:param name="replaceInto" />
	
		<xsl:variable name="booleanfieldId">
			<xsl:choose>
				<xsl:when test="contains($idString, ',')">
					<xsl:value-of select="substring-before($idString, ',')" />
				</xsl:when>
				<xsl:otherwise>
					<xsl:value-of select="." />
				</xsl:otherwise>
			</xsl:choose>
		</xsl:variable>
	
		<xsl:variable name="booleanfieldFullId">
			<xsl:call-template name="replaceMostSpecific">
				<xsl:with-param name="into" select="$replaceInto" />
				<xsl:with-param name="with" select="$booleanfieldId" />
			</xsl:call-template>
		</xsl:variable>
		
		<xsl:variable name="booleanfield" select="key('getBooleanfieldById', $booleanfieldFullId)" />
	
		<!-- If the booleanfield is true, write out its id -->
		<xsl:if test="$booleanfield/fi:value = 'true'">
			<xsl:value-of select="concat($booleanfieldId, ' ')" />
		</xsl:if>
	
		<!-- if there are more in the list apply recursively: -->
		<xsl:if test="contains($idString, ',')">
			<xsl:call-template name="booleanfieldToClass">
				<xsl:with-param name="idString" select="substring-after($idString, ',')" />
			</xsl:call-template>
		</xsl:if>
	</xsl:template>
	
	<!-- Utility template to get a full id using a local id and a sibling full id -->
	<xsl:template name="replaceMostSpecific">
		<xsl:param name="into" />
		<xsl:param name="with" />
		<xsl:choose>
			<xsl:when test="contains($into, '.')">
				<xsl:value-of select="concat(substring-before($into, '.'), '.')" />
				<xsl:call-template name="replaceMostSpecific">
					<xsl:with-param name="into" select="substring-after($into, '.')" />
					<xsl:with-param name="with" select="$with" />
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="$with" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	
	<!-- field with styling type="email-content": replace CR/LF with <br /> -->
	<xsl:template match="fi:field[fi:styling/@type = 'email-content']" priority="101">
		<span id="{@id}">
			<xsl:call-template name="splitLines">
				<xsl:with-param name="text" select="fi:value/text()" />
			</xsl:call-template>
		</span>
	</xsl:template>
	<xsl:template name="splitLines">
		<xsl:param name="text" />
		<xsl:choose>
			<xsl:when test="contains($text, '&#13;')">
				<xsl:value-of select="substring-before($text, '&#13;')" />
				<br />
				<xsl:call-template name="splitLines">
					<xsl:with-param name="text" select="substring-after($text, '&#13;&#10;')" />
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="$text" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	
	<!-- fi:messages: display as box with a button that clears the contents. -->
	<xsl:template match="fi:messages">
		<div id="{@id}">
			<xsl:if test="fi:message">
				<div class="alert">
				<xsl:for-each select="fi:message">
					<p><xsl:apply-templates/></p>
				</xsl:for-each>
				<input type="button" value="OK" onclick="
					var cont = this.parentNode.parentNode;
					while(cont.firstChild) cont.removeChild(cont.firstChild);
				" />
				</div>
			</xsl:if>
		</div>
	</xsl:template>

</xsl:stylesheet>
